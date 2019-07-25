const App = (function () {
    "use strict"

    /* #region GLOBAL STATE */
    const LOCAL_STORAGE_DATA_KEY = "secpad_data";
    const LOCAL_STORAGE_CONFIG_KEY = "secpad_config";
    const GITHUB_REPO_URL = "https://api.github.com/repos";
    const HEX_CHARS = "0123456789abcdef";
    const EDIT_COUNTDOWN_TO_SAVE = 2;
    const GLOBAL_INTERVAL_MILLISECONDS = 1000;
    const LOG_DEBUG = 10;
    const LOG_ERROR = 1;
    const LOG_OFF = 0;

        /* application state */
    let sections = [],
        nav = [],
        animation_queue = [],
        animation_time = 0,
        interval_id,
        edit_countdown = 0,
        edit_dirty = false,

        /* user state */
        log_level = LOG_DEBUG,
        master_password = "",
        loaded_cipher_text = null,

        /* dom elements */
        el_view_doc,
        el_view_authenticate,
        el_view_savelocal,
        el_view_about,
        el_view_github,
        el_nav_authenticate,
        el_nav_loadlocal,
        el_nav_loadlocal_file,
        el_nav_savelocal,
        el_nav_save,
        el_nav_cancel,
        el_nav_about,
        el_nav_close,
        el_nav_github,
        el_nav_deauthorize,
        el_view_doc_text,
        el_view_savelocal_filename,
        el_view_savelocal_password,
        el_view_savelocal_error,
        el_popover_message,
        el_view_authenticate_password,
        el_view_authenticate_error,
        el_view_github_master_password,
        el_view_github_confirm_password,
        el_view_github_username,
        el_view_github_password,
        el_view_github_reponame,
        el_view_github_filepath;

    const get_master_password = function() {
        return master_password;
    };

    const set_master_password = function(password) {
        master_password = password;
    };

    /* #endregion */

    /* #region LOGGING */
    const log = message => {
        if (is_instantiated(console) && is_instantiated(console.log)) {
            console.log(message);
        }
    };
    /* #endregion */

    /* #region EXTENSIONS */

    /*  String.prototype.to_arraybuffer
        arguments: none
        returns: a new instance of an ArrayBuffer filled with values copied from the string */
    String.prototype.to_arraybuffer = function() {
        // const buffer = new ArrayBuffer(this.length * 2);
        // const bufferView = new Uint16Array(buffer);
        // for (let i = 0, l = this.length; i < l; i++) {
        //     bufferView[i] = this.charCodeAt(i);
        // }
        // return buffer;
        const encoder = new TextEncoder();
        const buffer_view = encoder.encode(this);
        return buffer_view.buffer;
    };

    /*  ArrayBuffer.prototype.to_string
        arguments: none
        returns: a string filled with values copied from the ArrayBuffer */
    ArrayBuffer.prototype.to_string = function() {
        //return String.fromCharCode.apply(null, new Uint16Array(this));
        const decoder = new TextDecoder("utf-8", {fatal: true});
        const text = decoder.decode(this);
        return text;
    };

    /*  ArrayBuffer.prototype.to_hex_string
        arguments: none
        returns: a string filled with hex values values copied from the ArrayBuffer */
    ArrayBuffer.prototype.to_hex_string = function() {
        return Array.prototype.map.call(new Uint8Array(this), x => ("00" + x.toString(16)).slice(-2)).join('');
    };

    String.prototype.to_arraybuffer_from_hex = function() {
        const buffer = new ArrayBuffer(this.length / 2);
        const buffer_view = new Uint8Array(buffer);
        for (let i = 0, j = 0; i < this.length; i+=2, j++) {
            buffer_view[j] = HEX_CHARS.indexOf(this[i]) * 16 + HEX_CHARS.indexOf(this[i+1]);
        }
        return buffer;
    };
    /* #endregion */

    /* #region CRYPTO */
    const concatenate_buffers = function(/* buffer list */) {
        let length = 0;
        each(arguments, arg => { length += arg.byteLength; });
        let buffer = new ArrayBuffer(length);
        let buffer_view = new Uint8Array(buffer);
        let index = 0;
        each(arguments, item => { for (let i = 0; i < item.length; i++) { 
            buffer_view[index] = item[i];
            index++;
        }});
        return buffer;
    };

    /*  hash_string_sha256
        argument[0]: string to be hashed
        returns: promise with arraybuffer as result*/
    const hash_string_sha256 = function(to_be_hashed) {
        return crypto.subtle.digest("SHA-256", to_be_hashed.to_arraybuffer())
    };

    const encrypt_string_to_base64 = async function(password, plaintext) {
        // const sjcl_parameters = { mode: "gcm", ts: 128, adata: "secpad-auth", iter: 15000 };
        // return sjcl.encrypt(password, text, sjcl_parameters);
        let input_buffer = plaintext.to_arraybuffer();
        return await encrypt_aes_gcm(password, input_buffer)
            .then(output_buffer => StringView.bytesToBase64(new Uint8Array(output_buffer)));
    };

    const decrypt_base64_to_string = async function(password, base64_data) {
        // return sjcl.decrypt(password, cipher);
        let input_buffer = StringView.base64ToBytes(base64_data);
        return await decrypt_aes_gcm(password, input_buffer.buffer)
            .then(output_buffer => output_buffer.to_string());
    };

    const create_encrypt_info = async function(password, iv, salt) {
        if (!is_instantiated(iv)) {
            iv = crypto.getRandomValues(new Uint8Array(12));
        }
        if (!is_instantiated(salt)) {
            salt = crypto.getRandomValues(new Uint8Array(16));
        }
        const aes_param = { 
            name: "AES-GCM", 
            iv: iv,
            additionalData: "secpad-auth".to_arraybuffer(), 
            tagLength: 128,     // tag length in bits
            length: 256         // key length in bits
        };
        password = password.to_arraybuffer();
        const pbkdf2_param = {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: salt,
            iterations: 300143
        };
        const key_material = await crypto.subtle.importKey(
            "raw",                          // foramt
            password,
            pbkdf2_param,                   // uses { name: 'value' }
            false,                          // extratable
            ["deriveBits", "deriveKey"]);   // usages
        const key = await crypto.subtle.deriveKey(
            pbkdf2_param,
            key_material,
            aes_param,
            false,                           // extractable
            ["encrypt", "decrypt"]);         // usages
        
        return {
            aes: aes_param,
            pbkdf2: pbkdf2_param,
            key: key
        };
    };

    // the CryptoKey api isn't supported on Safari or IE at this time
    const encrypt_aes_gcm = async function(password, input_buffer) {
        const info = await create_encrypt_info(password);
        const encrypted_data = await crypto.subtle.encrypt(
            info.aes,
            info.key,
            input_buffer);
        const version = new Uint8Array([1]);
        const output_buffer = concatenate_buffers(
            version, 
            info.aes.iv, 
            info.pbkdf2.salt, 
            new Uint8Array(encrypted_data));
        return output_buffer;
    };

    const decrypt_aes_gcm = async function(password, input_buffer) {
        const version = new Uint8Array(input_buffer, 0, 1);
        const iv = new Uint8Array(input_buffer, 1, 12);
        const salt = new Uint8Array(input_buffer, 13, 16);
        const encrypted_data = new Uint8Array(input_buffer, 29);
        if (version[0] !== 1) {
            throw "Invalid Version: " + version[0] + " Expected: 1";
        }
        const info = await create_encrypt_info(password, iv, salt); 
        const output_buffer = await crypto.subtle.decrypt(
            info.aes,
            info.key,
            encrypted_data);
        return output_buffer;
    };
    /* #endregion */

    /* #region DOM WRAPPERS */
    const is_function       = obj => (typeof obj === "function");
    const is_instantiated   = obj => !(obj === null || typeof obj === "undefined");
    const swap              = (array, i, j) => { let temp = array[i]; array[i] = array[j]; array[j] = temp; };
    const each              = (array, callback) => { 
        for (let i = 0; i < array.length; i++) {
            callback(array[i], i, array);
        }
    };
    const remove            = (array, item) => {
        for(let i = 0; i < array.length; i++) {
            if (array[i] === item) {
                swap(array, i, array.length - 1);
                array.pop();
            }
        }
    };

    const dom_query = function (selector, el) {
        let result;
        if (el) {
            result = el.querySelectorAll(selector);
        } else {
            result = document.querySelectorAll(selector);
        }
        if (result) {
            if (result.length === 1) {
                return result[0];
            } else {
                return result;
            }
        }
    };

    const center = function(el, center_on) {
        if (!is_instantiated(center_on)) {
            center_on = document.body;
        }
        el.style.top = center_on.style.top + center_on.clientHeight / 2 - el.clientHeight / 2;
        el.style.left = center_on.style.left + center_on.clientWidth / 2 - el.clientWidth / 2;
    };

    const show = function(el) {
        if (el.style.display === "none") {
            if (el.style.old_display) {
                el.style.display = el.style.old_display;
            } else {
                el.style.display = "inline-block";
            }
        }
    };

    const hide = function(el) {
        if (el.style.display !== "none") {
            el.style.old_display = el.style.display;
            el.style.display = "none";
        }
    };

    const add_event_listener = function (el, event_name, handler) {
        el.addEventListener(event_name, handler);
    };

    const add_click_handler = function (el, handler) {
        add_event_listener(el, "click", handler);
    };

    const add_change_handler = function (el, handler) {
        add_event_listener(el, "change", handler);
    };

    const add_keydown_handler = function (el, handler) {
        add_event_listener(el, "keydown", handler)
    };

    const add_keyup_handler = function(el, handler) {
        add_event_listener(el, "keyup", handler);
    };

    const add_paste_handler = function (el, handler) {
        add_event_listener(el, "paste", handler);
    };

    const get_local = async function (key) {
        const password = get_master_password();
        const encrypted_value = localStorage.getItem(key);
        const json = await decrypt_base64_to_string(password, encrypted_value);
        const obj = JSON.parse(json);
        return obj;
    };

    const set_local = async function (key, value) {
        const password = get_master_password();
        const json = JSON.stringify(value);
        const encrypted_value = await encrypt_string_to_base64(password, json);
        localStorage.setItem(key, encrypted_value);
    };
    /* #endregion */

    /* #region ANIMATION  */
    const lerp_number = function (from, to, duration, elapsed) {
        return from + (to - from) * elapsed / duration
    }

    const animation_loop = function (t) {
        // we don't run the animation loop all the time so we use
        // aniatmion_time to control if an animation is currently
        // running or not. 0 means not running. we need to initialize
        // the value to the current time (t) so our animation steps
        // have the correct elapsed time values.
        if (animation_time == 0) {
            animation_time = t;
            requestAnimationFrame(animation_loop);
        }
        else if (animation_queue.length > 0) {
            const elapsed_from_last_frame = t - animation_time;
            animation_time = t;
            for (let i = 0; i < animation_queue.length; i++) {
                const item = animation_queue[i];
                item.elapsed += elapsed_from_last_frame;
                if (item.elapsed >= item.duration) {
                    item.el.style[item.prop_name] = item.to;
                    remove(animation_queue, item);
                    if (item.finished_callback) {
                        item.finished_callback();
                    }
                } else {
                    item.el.style[item.prop_name] = item.interpolation_delegate(item.from, item.to, item.duration, item.elapsed);
                }
            }
            requestAnimationFrame(animation_loop);
        }
        else if (animation_queue.length === 0) {
            animation_time = 0;
        }
    };

    const animate = function (el, prop_name, from, to, duration, interpolation_delegate, finished_callback) {
        // check for existing animation with same el and property
        let animation_item = animation_queue.find(item => item.el === el && item.prop_name === prop_name);
        
        // if not found, create a new animation_item
        if (typeof animation_item === "undefined" || animation_item === null) {
            animation_item = {
                el: el, 
                prop_name: prop_name
            };
            animation_queue.push(animation_item);
        }

        animation_item.from = from;
        animation_item.to = to;
        animation_item.duration = duration;
        animation_item.elapsed = 0;
        animation_item.interpolation_delegate = interpolation_delegate;
        animation_item.finished_callback = finished_callback;

        el.style[prop_name] = from;

        if (animation_queue.length === 1) {
            requestAnimationFrame(animation_loop);
        }
    };
    /* #endregion */

    /* #region NAVIGATION */
    const toggle_section = function(el) {
        for (let i = 0; i < sections.length; i++) {
            if (sections[i] === el) {
                show(sections[i]);
            } else {
                hide(sections[i]);
            }
        }
    };

    const toggle_nav = function (/* variable number of nav element arguments */) {
        for (let i = 0; i < nav.length; i++) {
            hide(nav[i]);
        }
        for (let i = 0; i < arguments.length; i++) {
            show(arguments[i]);
        }
    };

    const toggle_nav_view_doc = function () {
        toggle_nav(el_nav_loadlocal, el_nav_savelocal, el_nav_github, el_nav_about);
        toggle_section(el_view_doc);
    };
    /* #endregion */

    /* #region HANDLERS */

    const clear_for_safety = function() {
        log("clear_for_safety called");
        each(dom_query("input"), item => {
            item.value = ""; 
            item.classList.remove("error"); });
        loaded_cipher_text = null;
        each(dom_query("nav a"), item => item.secpad_click_handler = null);
        each(dom_query("section"), item => {
            item.secpad_default_enter_press_handler = null;
            item.secpad_default_esc_press_handler = null; });
    };

    const nav_dynamic_click_handler = function (evnt) {
        if (is_function(evnt.target.secpad_click_handler)) {
            evnt.target.secpad_click_handler(evnt)
                .then(clear_for_safety)
                .catch(error => { log(error); });
        }
    };

    const view_dynamic_default_keyup_handler = function(evnt) {
        const key = evnt.key;
        //log("Key Up: " + key);
        const el_section = evnt.target.closest("section");
        if (el_section) {
            if (key === "Enter") {
                if (is_function(el_section.secpad_default_enter_press_handler)) {
                    el_section.secpad_default_enter_press_handler(evnt)
                        .then(clear_for_safety)
                        .catch(error => { log("Key Up Handler Error: " + error); });
                }
            }
            else if (key === "Escape") {
                if (is_function(el_section.secpad_default_esc_press_handler)) {
                    el_section.secpad_default_esc_press_handler(evnt)
                        .then(clear_for_safety)
                        .catch(error => { log("Escape Handler Error: " + error); });
                }
            }
        }
    };

    const nav_about_click_handler = function () {
        toggle_nav(el_nav_close);
        toggle_section(el_view_about);

        el_nav_close.secpad_click_handler = () => {
            return new Promise((resolve, reject) => {
                toggle_nav_view_doc();
                resolve();
            });
        };
    };

    const view_doc_text_edit_handler = function (e) {
        edit_countdown = EDIT_COUNTDOWN_TO_SAVE;
        edit_dirty = true;
    };

    const timer_tick_handler = function () {
        if (edit_countdown > 0) {
            edit_countdown -= 1;
        }
        if (edit_countdown == 0 && edit_dirty) {
            edit_dirty = false;
            const text = el_view_doc_text.value;
            hash_string_sha256(text)
            .then(hashed_value => {
                const hex_value = hashed_value.to_hex_string();
                if (el_view_doc_text.saved_hashed_value !== hex_value) {
                    el_view_doc_text.saved_hashed_value = hex_value;
                    log(hex_value + " " + text);
                    if (master_password) {
                        text = encrypt(master_password, text);
                        set_local(LOCAL_STORAGE_DATA_KEY, text);
                        show_saved_to_local_storage();
                    } else {
                        log("global password not set, local storage save disabled.");
                    }
                }
            });
        }
    };
    /* #endregion */

    /* #region MESSAGES */
    const show_popover_message = function(message, cssclass, duration) {
        el_popover_message.innerHTML = message;
        el_popover_message.className = cssclass;
        show(el_popover_message);
        center(el_popover_message);
        // animate opacity from 1 to 0 over 1.5 seconds
        animate(el_popover_message, "opacity", 1, 0, duration, lerp_number, function(){ hide(el_popover_message); });
    };

    const show_saved_to_local_storage = function() {
        show_popover_message("Saved to Local Storage", "green", 1500);
    };
    /* #endregion */

    /* #region SAVE LOCAL ( EXPORT TO FILE ) */
    const nav_savelocal_click_handler = function () {
        toggle_nav(el_nav_save, el_nav_cancel);
        toggle_section(el_view_savelocal);
        el_nav_save.secpad_click_handler = nav_savelocal_save_handler;
        el_nav_cancel.secpad_click_handler = nav_savelocal_cancel_handler;
        el_view_savelocal.secpad_default_enter_press_handler = nav_savelocal_save_handler;
        el_view_savelocal.secpad_default_esc_press_handler = nav_savelocal_cancel_handler;
        el_view_savelocal_filename.focus();
    };

    const nav_savelocal_save_handler = function() {
        return new Promise(function(resolve, reject) {
            try {
                let filename = el_view_savelocal_filename.value;
                let password = el_view_savelocal_password.value;
                let text = el_view_doc_text.value;
                if (filename.length === 0) {
                    filename = "secpad.json";
                }
                text = encrypt(password, text);
                const file = new File([text], filename, { type: "text/plain; charset=utf=8" });
                saveAs(file);
                toggle_nav_view_doc();
                resolve();
            } catch (ex) {
                el_view_savelocal_error.innerHTML = ex;
                reject(ex);
            }
        });
    };

    const nav_savelocal_cancel_handler = function() {
        return new Promise(function(resolve, reject) {
            toggle_nav_view_doc();
            resolve();
        });
    };
    /* #endregion */

    /* #region LOAD LOCAL ( LOAD FROM FILE ) */
    const nav_loadlocal_file_change_handler = function () {
        if (el_nav_loadlocal_file.files.length > 0) {
            var file_reader = new FileReader();
            file_reader.onload = function () {
                loaded_cipher_text = file_reader.result;
                toggle_nav(el_nav_authenticate, el_nav_cancel);
                toggle_section(el_view_authenticate);
                el_nav_authenticate.secpad_click_handler = nav_loadlocal_auth_handler;
                el_nav_cancel.secpad_click_handler = nav_loadlocal_cancel_handler;
                el_view_authenticate.secpad_default_enter_press_handler = nav_loadlocal_auth_handler;
                el_view_authenticate.secpad_default_esc_press_handler = nav_loadlocal_cancel_handler;
                el_view_authenticate_password.focus();
            };
            file_reader.readAsText(el_nav_loadlocal_file.files[0])
        }
    };

    const nav_loadlocal_auth_handler = function() {
        return new Promise(function(resolve, reject) {
            try {
                const text = decrypt(el_view_authenticate_password.value, loaded_cipher_text);
                el_view_doc_text.value = text;
                toggle_nav_view_doc();
                resolve();
            } catch(ex) {
                el_view_authenticate_error.innerHTML = ex;
                reject(ex);
            }
        });
    };

    const nav_loadlocal_cancel_handler = function() {
        return new Promise(function(resolve, reject) {
            toggle_nav_view_doc();
            resolve();
        });
    };
    /* #endregion */

    /* #region GITHUB */
    const nav_github_click_handler = function () {
        toggle_nav(el_nav_save, el_nav_close);
        toggle_section(el_view_github);
        el_view_github_master_password.focus();
        el_nav_save.secpad_click_handler = nav_github_save_handler;
        el_nav_close.secpad_click_handler = nav_github_close_handler;
        el_view_github.secpad_default_enter_press_handler = nav_github_save_handler;
        el_view_github.secpad_default_esc_press_handler = nav_github_close_handler;
    };

    const nav_github_save_handler = function() {
        return validate(el_view_github)
            .then(() => authenticate_github(
                el_view_github_username.value, 
                el_view_github_password.value, 
                el_view_github_reponame.value))
            .then(success => {
                return new Promise((resolve, reject) => {
                    if (success) {
                        set_master_password(el_view_github_master_password.value);
                        let info = {
                            type: "github",
                            username: el_view_github_username.value,
                            password: el_view_github_password.value,
                            reponame: el_view_github_reponame.value,
                            filepath: el_view_github_filepath.value
                        };
                        set_local(LOCAL_STORAGE_CONFIG_KEY, info);
                    } else {
                        reject("Github Validation Failed");
                    }
                });
            });
    };

    const nav_github_close_handler = function() {
        return new Promise((resolve, reject) => {
            try {
                toggle_nav_view_doc();
                resolve();
            } catch(error) {
                log("Github close handler error: " + error);
            }
        });
    };

    const call_github = function(url, method, username, password) {
        let request = new Request(url);
        let headers = new Headers();
        headers.append("Accept", "application/vnd.github.v3+json");
        headers.append("Authorization", "Basic " + btoa(username + ":" + password));
        let config = {
            method: method.toUpperCase(),
            headers: headers,
            mode: "cors"
        };
        return fetch(request, config)
            .catch(error => { log("Call to Github failed with error: " + error); });
    };

    const authenticate_github = function(username, password, repo) {
        const url = GITHUB_REPO_URL + "/" + username + "/" + repo;
        return call_github(url, "GET", username, password)
            .then(response => { return response.json(); })
            .then(data => {
                return new Promise((resolve, reject) => {
                try {
                    if (data.id && data.name.toLowerCase() === repo.toLowerCase() && data.permissions.push === true) {
                        log("GitHub Validated");
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch {
                    resolve(false);
                }}); 
            });
    };

    const commit_file_to_github = function() {
        const url = GITHUB_REPO_URL + "/" + username
    };

    /* #endregion */

    /* #region VALIDATION */
    const validate = function (el_container) {
        return new Promise((resolve, reject) => {
            let is_valid = true;
            each(dom_query("input", el_container), el => {
                let el_is_valid = true;
                if (el.validators && el.validators.length > 0) {
                    each(el.validators, validator => {
                        if (!validator.call(el)) {
                            el_is_valid = false;
                        }
                    });
                }
                if (el_is_valid) {
                    el.classList.remove("error");
                }
                else {
                    el.classList.add("error");
                    is_valid = false;
                }
            });
            if (is_valid) {
                resolve();
            } else {
                reject("Validation Failed");
            }
        });
    };

    const add_validator = function(el, validator) {
        if (el && validator) {
            if (!is_instantiated(el.validators)) {
                el.validators = [];
            }
            el.validators.push(validator);
        }
    };

    /* the 'this' parameter is the element to validate */
    const validate_input_required = function() {
        let is_valid = this.value.length > 0;
        return is_valid;
    };

    const validate_github_master_password = function() {
        if (el_view_github_master_password.value === el_view_github_confirm_password.value) {
            return true;
        } else {
            return false;
        }
    };
    /* #endregion */

    /* #region TESTS */
    const _test_result_container;
    const _test_ascii_keyboard_characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}\\|;:'\",<.>/?`~ \t";
    const _test_ascii_keyboard_characters_to_hex = "6162636465666768696a6b6c6d6e6f707172737475767778797a4142434445464748494a4b4c4d4e4f505152535455565758595a3031323334353637383921402324255e262a28295f2b2d3d5b5d7b7d5c7c3b3a27222c3c2e3e2f3f607e2009";
    
    const _test_write_success = function(test_name) {
        if (is_instantiated(_test_result_container)) {
            let el = document.createElement("li");
            el.innerHTML = test_name;
            el.classList.add("green");
            _test_result_container.append(el);
        }
    };

    const _test_write_failure = function(test_name, message) {
        if (is_instantiated(_test_result_container)) {
            let el = document.createElement("li");
            el.innerHTML = test_name + "<br />" + message;
            el.classList.add("red");
            _test_result_container.append(el);
        }
    };

    const _test_runner = function(test_name, test_lambda) {
        return (new Promise((resolve, reject) => {
            try {
                let ret = test_lambda();
                if (typeof ret === "object" && ret.constructor === Promise) {
                    ret.then(() => resolve({name: test_name, error: ""}));
                    ret.catch(ex => reject({name: test_name, error: ex}));
                } else {
                    resolve({name: test_name, error: ""});
                }
            } catch (ex) {
                reject({name: test_name, error: ex});
            }
        }))
        .then(success_result => {
            _test_write_success(success_result.name);
        }, error_result => {
            _test_write_failure(error_result.name, error_result.error);
        });
    };

    const _test_assert_equals = function(expected, actual) {
        if (expected !== actual) {
            throw "expected: " + expected + " actual: " + actual;
        }
    };

    const _test_suite = async function() {
        await _test_runner("to_arraybuffer().to_string()", () => {
            let utf8_arraybuffer = _test_ascii_keyboard_characters.to_arraybuffer();
            let str = utf8_arraybuffer.to_string();
            _test_assert_equals(_test_ascii_keyboard_characters.length, utf8_arraybuffer.bytelength);
            _test_assert_equals(_test_ascii_keyboard_characters, str);
        });

        await _test_runner("to_hex_string().to_arraybuffer_from_hex", () => {
            let buffer1 = _test_ascii_keyboard_characters.to_arraybuffer();
            let hex_string = utf8_arraybuffer.to_hex_string();
            _test_assert_equals(_test_ascii_keyboard_characters_to_hex, hex_string);
            let buffer2 = hex_string.to_arraybuffer_from_hex();
            _test_assert_equals(_test_ascii_keyboard_characters.length, buffer2.bytelength);
            let str = buffer2.to_string();
            _test_assert_equals(_test_ascii_keyboard_characters, str);
        });
    };
    /* #endregion */

    const app_start = function () {

        // SECTIONS ( VIEWS )
        sections.push(el_view_doc = dom_query("#view_doc"));
        sections.push(el_view_authenticate = dom_query("#view_authenticate"));
        sections.push(el_view_savelocal = dom_query("#view_savelocal"));
        sections.push(el_view_about = dom_query("#view_about"));
        sections.push(el_view_github = dom_query("#view_github"));
        
        // NAVIGATION ELEMENTS
        nav.push(el_nav_authenticate = dom_query("#nav_authenticate"));
        nav.push(el_nav_loadlocal = dom_query("#nav_loadlocal"));
        nav.push(el_nav_savelocal = dom_query("#nav_savelocal"));
        nav.push(el_nav_save = dom_query("#nav_save"));
        nav.push(el_nav_cancel = dom_query("#nav_cancel"));
        nav.push(el_nav_github = dom_query("#nav_github"));
        nav.push(el_nav_deauthorize = dom_query("#nav_deauthorize"));
        nav.push(el_nav_about = dom_query("#nav_about"));
        nav.push(el_nav_close = dom_query("#nav_close"));
        
        // INPUT ELEMENTS
        el_nav_loadlocal_file = dom_query("input", el_nav_loadlocal);
        el_view_doc_text = dom_query("#view_doc_text");
        el_view_doc_text.value = "";
        el_view_authenticate_password = dom_query("#view_authenticate_password");
        el_view_authenticate_error = dom_query("#view_authenticate_error");
        el_view_savelocal_filename = dom_query("#view_savelocal_filename");
        el_view_savelocal_password = dom_query("#view_savelocal_password");
        el_view_savelocal_error = dom_query("#view_savelocal_error");
        el_view_github_master_password = dom_query("#view_github_master_password");
        el_view_github_confirm_password = dom_query("#view_github_confirm_password");
        el_view_github_username = dom_query("#view_github_username");
        el_view_github_password = dom_query("#view_github_password");
        el_view_github_reponame = dom_query("#view_github_reponame");
        el_view_github_filepath = dom_query("#view_github_filepath");
        el_popover_message = dom_query("#popover_message");
        
        // init
        // TODO: handler local saved config
        clear_for_safety();
        hide(el_popover_message);
        toggle_nav_view_doc();

        // EVENT HANDLERS
        add_click_handler(el_nav_savelocal, nav_savelocal_click_handler);
        add_click_handler(el_nav_github, nav_github_click_handler);
        add_click_handler(el_nav_about, nav_about_click_handler);
        add_click_handler(el_nav_save, nav_dynamic_click_handler);
        add_click_handler(el_nav_cancel, nav_dynamic_click_handler);
        add_click_handler(el_nav_close, nav_dynamic_click_handler);
        add_click_handler(el_nav_authenticate, nav_dynamic_click_handler);
        add_change_handler(el_nav_loadlocal_file, nav_loadlocal_file_change_handler);
        add_change_handler(el_view_doc_text, view_doc_text_edit_handler);
        add_keydown_handler(el_view_doc_text, view_doc_text_edit_handler);
        add_paste_handler(el_view_doc_text, view_doc_text_edit_handler);
        add_keyup_handler(el_view_authenticate, view_dynamic_default_keyup_handler);
        add_keyup_handler(el_view_savelocal, view_dynamic_default_keyup_handler);
        add_keyup_handler(el_view_github, view_dynamic_default_keyup_handler);

        // VALIDATION
        add_validator(el_view_github_master_password, validate_github_master_password);
        add_validator(el_view_github_confirm_password, validate_github_master_password);
        add_validator(el_view_github_username, validate_input_required);
        add_validator(el_view_github_password, validate_input_required);
        add_validator(el_view_github_reponame, validate_input_required);
        add_validator(el_view_github_filepath, validate_input_required);

        interval_id = setInterval(timer_tick_handler, GLOBAL_INTERVAL_MILLISECONDS);

        // const stored_data = get_local(LOCAL_STORAGE_DATA_KEY);
        // const stored_config = get_local(LOCAL_STORAGE_CONFIG_KEY);
        // if (stored_data) {
        //     el_view_doc_text.value = stored_data;
        // }
    };

    if (document.readyState === "complete" || document.readyState === "loaded") {
        app_start();
    } else {
        window.addEventListener("DOMContentLoaded", app_start);
    }

})();
