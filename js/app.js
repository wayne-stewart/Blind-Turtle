const App = (function () {
    "use strict"

    /* #region GLOBAL STATE */
    const LOCAL_STORAGE_DATA_KEY = "secpad_data";
    const LOCAL_STORAGE_CONFIG_KEY = "secpad_config";
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
        log_level = LOG_OFF,
        global_password = "",
        loaded_cipher_text = null,

        /* dom elements */
        el_view_doc,
        el_view_authenticate,
        el_view_savelocal,
        el_view_about,
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
        el_view_authenticate_error;
    /* #endregion */
    
    const log = function(level, message_func) {
        if (level <= log_level && typeof message_func === "function") {
            console.log(message_func());
        }
    };

    /* #region EXTENSIONS */
    /*  Array.prototype.swap
        arguments: the two indexes to swap in the array.
        returns: undefined */
    Array.prototype.swap = function(i, j) {
        let temp = this[i];
        this[i] = this[j];
        this[j] = temp;
    };

    /*  Array.prototype.remove
        argument[0]: the item to be removed
        returns: the item that was removed
        notes: Element order is not preserved when removing items; */
    Array.prototype.remove = function(item) {
        for(let i = 0; i < this.length; i++) {
            if (this[i] === item) {
                this.swap(i, this.length - 1);
                return this.pop();
            }
        }
    };

    /*  String.prototype.to_arraybuffer
        arguments: none
        returns: a new instance of an ArrayBuffer filled with values copied from the string */
    String.prototype.to_arraybuffer = function() {
        const buffer = new ArrayBuffer(this.length * 2);
        const bufferView = new Uint16Array(buffer);
        for (let i = 0, l = this.length; i < l; i++) {
            bufferView[i] = this.charCodeAt(i);
        }
        return buffer;
    };

    /*  ArrayBuffer.prototype.to_string
        arguments: none
        returns: a string filled with values copied from the ArrayBuffer */
    ArrayBuffer.prototype.to_string = function() {
        return String.fromCharCode.apply(null, new Uint16Array(this));
    };

    /*  ArrayBuffer.prototype.to_hex_string
        arguments: none
        returns: a string filled with hex values values copied from the ArrayBuffer */
    ArrayBuffer.prototype.to_hex_string = function() {
        return Array.prototype.map.call(new Uint8Array(this), x => ("00" + x.toString(16)).slice(-2)).join('');
    };
    /* #endregion */

    /* #region CRYPTO */
    /*  hash_string_sha256
        argument[0]: string to be hashed
        returns: promise with arraybuffer as result*/
    const hash_string_sha256 = function(to_be_hashed) {
        return crypto.subtle.digest("SHA-256", to_be_hashed.to_arraybuffer())
    };

    const encrypt = function(password, text) {
        const sjcl_parameters = { mode: "gcm", ts: 128, adata: "secpad-auth", iter: 15000 };
        return sjcl.encrypt(password, text, sjcl_parameters);
    };

    const decrypt = function(password, cipher) {
        return sjcl.decrypt(password, cipher);
    };

    // the CryptoKey api isn't supported on Safari or IE at this time
    // const encrypt_aes_gcm = function(password, plaintext) {
    //     const aes_param = { 
    //         name: "AES-GCM", 
    //         iv: crypto.getRandomValues(new Uint8Array(12)), 
    //         additionalData: "secpad-auth".to_arraybuffer(), 
    //         tagLength: 128
    //     };
    //     const encoder = new TextEncoder();
    //     const encoded = encoder.encode(plaintext);
    //     const pbkdf2_param = {
    //         name: "PBKDF2",
    //         hash: "SHA-256",
    //         salt: crypto.getRandomValues(new Uint8Array(16)),
    //         iterations: 3797
    //     };
    //     const base_key = crypto.
    // };

    // const decrypt_aes_gcm = function(password, ciphertext) {

    // };
    /* #endregion */

    /* #region DOM WRAPPERS */
    const dom_query = function (selector, el) {
        if (el) {
            return el.querySelector(selector);
        } else {
            return document.querySelector(selector);
        }
    };

    const center = function(el, center_on) {
        if (typeof center_on === "undefined") {
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

    const add_paste_handler = function (el, handler) {
        add_event_listener(el, "paste", handler);
    };

    const get_local = function (key) {
        return localStorage.getItem(key);
    };

    const set_local = function (key, value) {
        localStorage.setItem(key, value);
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
                    animation_queue.remove(item);
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
        toggle_nav(el_nav_loadlocal, el_nav_savelocal, el_nav_about);
        toggle_section(el_view_doc);
    };

    const toggle_nav_view_savelocal = function () {
        toggle_nav(el_nav_save, el_nav_cancel);
        toggle_section(el_view_savelocal);
    };

    const toggle_nav_view_authenticate = function () {
        toggle_nav(el_nav_authenticate, el_nav_cancel);
        toggle_section(el_view_authenticate);
    };

    const toggle_nav_view_about = function () {
        toggle_nav(el_nav_close);
        toggle_section(el_view_about);
    };
    /* #endregion */

    /* #region HANDLERS */
    const nav_savelocal_click_handler = function () {
        el_view_savelocal_filename.value = "";
        toggle_nav_view_savelocal();
        el_view_savelocal_filename.focus();
        el_nav_save.save_handler = nav_savelocal_save_handler;
        el_nav_cancel.cancel_handler = nav_savelocal_cancel_handler;
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

    const clear_for_safety = function() {
        el_nav_save.save_handler = null;
        el_view_authenticate_password.value = "";
        el_view_authenticate_error.innerHTML = "";
        el_view_authenticate.auth_handler = null;
        el_view_savelocal_filename.value = "";
        el_view_savelocal_password.value = "";
        el_view_savelocal_error.innerHTML = "";
        loaded_cipher_text = null;
        el_nav_save.save_handler = null;
        el_nav_authenticate.auth_handler = null;
        el_nav_cancel.cancel_handler = null;
        el_nav_close.close_handler = null;
    };

    const nav_save_click_handler = function () {
        if (typeof el_nav_save.save_handler === "function") {
            el_nav_save.save_handler()
                .then(clear_for_safety)
                .catch((error) => { log(LOG_ERROR, () => error); });
        }
    };

    const nav_cancel_click_handler = function () {
        if (typeof el_nav_cancel.cancel_handler === "function") {
            el_nav_cancel.cancel_handler()
                .then(clear_for_safety)
                .catch((error) => { log(LOG_ERROR, () => error); });
        }
    };

    const nav_close_click_handler = function () {
        if (typeof el_nav_close.close_handler === "function") {
            el_nav_close.close_handler()
                .then(clear_for_safety)
                .catch((error) => { log(LOG_ERROR, () => error); });
        }
    };

    const nav_about_click_handler = function () {
        toggle_nav_view_about();
        el_nav_close.close_handler = nav_about_close_handler;
    };

    const nav_about_close_handler = function() {
        return new Promise((resolve, reject) => {
            toggle_nav_view_doc();
            resolve();
        });
    };

    const nav_authenticate_click_handler = function() {
        if (typeof el_nav_authenticate.auth_handler === "function") {
            el_nav_authenticate.auth_handler()
                .then(clear_for_safety)
                .catch((error) => { log(LOG_ERROR, () => error); });
        }
    };

    const nav_loadlocal_file_change_handler = function () {
        if (el_nav_loadlocal_file.files.length > 0) {
            var file_reader = new FileReader();
            file_reader.onload = function () {
                loaded_cipher_text = file_reader.result;
                toggle_nav_view_authenticate();
                el_nav_authenticate.auth_handler = nav_loadlocal_auth_handler;
                el_nav_cancel.cancel_handler = nav_loadlocal_cancel_handler;
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
                    log(LOG_DEBUG, () => hex_value + " " + text);
                    if (global_password) {
                        text = encrypt(global_password, text);
                        set_local(LOCAL_STORAGE_DATA_KEY, text);
                        show_saved_to_local_storage();
                    } else {
                        log(LOG_DEBUG, () => "global password not set, local storage save disabled.");
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

    const app_start = function () {
        sections.push(el_view_doc = dom_query("#view_doc"));
        sections.push(el_view_authenticate = dom_query("#view_authenticate"));
        sections.push(el_view_savelocal = dom_query("#view_savelocal"));
        sections.push(el_view_about = dom_query("#view_about"));
        nav.push(el_nav_authenticate = dom_query("#nav_authenticate"));
        nav.push(el_nav_loadlocal = dom_query("#nav_loadlocal"));
        nav.push(el_nav_savelocal = dom_query("#nav_savelocal"));
        nav.push(el_nav_save = dom_query("#nav_save"));
        nav.push(el_nav_cancel = dom_query("#nav_cancel"));
        nav.push(el_nav_github = dom_query("#nav_github"));
        nav.push(el_nav_deauthorize = dom_query("#nav_deauthorize"));
        nav.push(el_nav_about = dom_query("#nav_about"));
        nav.push(el_nav_close = dom_query("#nav_close"));
        el_nav_loadlocal_file = dom_query("input", el_nav_loadlocal);
        el_view_doc_text = dom_query("#view_doc_text");
        el_view_authenticate_password = dom_query("#view_authenticate_password");
        el_view_authenticate_error = dom_query("#view_authenticate_error");
        el_view_savelocal_filename = dom_query("#view_savelocal_filename");
        el_view_savelocal_password = dom_query("#view_savelocal_password");
        el_view_savelocal_error = dom_query("#view_savelocal_error");
        el_popover_message = dom_query("#popover_message");
        
        // init
        // TODO: handler local saved config
        clear_for_safety();
        hide(el_popover_message);
        toggle_nav_view_doc();

        //add_click_handler(el_nav_authenticate, el_authenticate_click_handler);
        add_click_handler(el_nav_savelocal, nav_savelocal_click_handler);
        add_click_handler(el_nav_save, nav_save_click_handler);
        add_click_handler(el_nav_cancel, nav_cancel_click_handler);
        add_click_handler(el_nav_close, nav_close_click_handler);
        add_click_handler(el_nav_about, nav_about_click_handler);
        add_click_handler(el_nav_authenticate, nav_authenticate_click_handler);
        add_change_handler(el_nav_loadlocal_file, nav_loadlocal_file_change_handler);
        add_change_handler(el_view_doc_text, view_doc_text_edit_handler);
        add_keydown_handler(el_view_doc_text, view_doc_text_edit_handler);
        add_paste_handler(el_view_doc_text, view_doc_text_edit_handler);

        interval_id = setInterval(timer_tick_handler, GLOBAL_INTERVAL_MILLISECONDS);

        const stored_data = get_local(LOCAL_STORAGE_DATA_KEY);
        const stored_config = get_local(LOCAL_STORAGE_CONFIG_KEY);
        if (stored_data) {
            el_view_doc_text.value = stored_data;
        }
    };

    if (document.readyState === "complete" || document.readyState === "loaded") {
        app_start();
    } else {
        window.addEventListener("DOMContentLoaded", app_start);
    }

})();
