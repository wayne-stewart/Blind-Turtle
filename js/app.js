const App = (function () {
    "use strict"

    const LOCAL_STORAGE_KEY = "secpad_data";
    const EDIT_COUNTDOWN_TO_SAVE = 2;
    const GLOBAL_INTERVAL_MILLISECONDS = 1000;
    const LOG_DEBUG = 10;
    const LOG_ERROR = 1;
    const LOG_OFF = 0;

    let sections = [],
        nav = [],
        log_level = LOG_OFF,
        animation_queue = [],
        animation_time = 0,
        interval_id,
        edit_countdown = 0,
        edit_dirty = false,
        global_password = "",
        el_view_doc,
        el_view_authenticate,
        el_view_savelocal,
        el_nav_authenticate,
        el_nav_loadlocal,
        el_nav_loadlocal_file,
        el_nav_savelocal,
        el_nav_save,
        el_nav_cancel,
        el_view_doc_text,
        el_view_savelocal_filename,
        el_view_savelocal_password,
        el_popover_message,
        el_view_authenticate_password;
    
    const log = function(level, message_func) {
        if (level <= log_level && typeof message_func === "function") {
            console.log(message_func());
        }
    };

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

    String.prototype.to_arraybuffer = function() {
        const buffer = new ArrayBuffer(this.length * 2);
        const bufferView = new Uint16Array(buffer);
        for (let i = 0, l = this.length; i < l; i++) {
            bufferView[i] = this.charCodeAt(i);
        }
        return buffer;
    };

    ArrayBuffer.prototype.to_string = function() {
        return String.fromCharCode.apply(null, new Uint16Array(this));
    };

    ArrayBuffer.prototype.to_hex_string = function() {
        return Array.prototype.map.call(new Uint8Array(this), x => ("00" + x.toString(16)).slice(-2)).join('');
    };

    /*  hash_string_sha256
        argument[0]: string to be hashed
        returns: promise with arraybuffer as result*/
    const hash_string_sha256 = function(to_be_hashed) {
        return crypto.subtle.digest("SHA-256", to_be_hashed.to_arraybuffer())
    };

    const encrypt = function(password, text) {
        const sjcl_parameters = { mode: "gcm", ts: 128, adata: "secpad-auth", iter: 15000 };
        sjcl.encrypt(password, text, sgcl_parameters);
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

    const dom_query = function (selector, el) {
        if (el) {
            return el.querySelector(selector);
        } else {
            return document.querySelector(selector);
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
        show_saved_to_local_storage();
    };

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

    const toggle_nav_init = function () {
        toggle_nav(el_nav_loadlocal, el_nav_savelocal);
    };

    const el_savelocal_click_handler = function () {
        el_view_savelocal_filename.value = "";
        toggle_nav(el_nav_save, el_nav_cancel);
        toggle_section(el_view_savelocal);
        el_view_savelocal_filename.focus();
        el_nav_save.save_handler = function () {
            let filename = el_view_savelocal_filename.value;
            let password = el_view_savelocal_password.value;
            let text = el_view_doc_text.value;
            if (filename.length === 0) {
                if (password.length > 0) {
                    filename = "secpad.json"
                } else {
                    filename = "secpad.txt"
                }
            }
            if (password.length > 0) {
                text = encrypt(password, text);
            }
            const file = new File([text], filename, { type: "text/plain; charset=utf=8" });
            saveAs(file);
            toggle_nav_init();
            toggle_section(el_view_doc);
        };
    };

    const el_save_click_handler = function () {
        if (typeof el_nav_save.save_handler == "function") {
            el_nav_save.save_handler();
            // for safety, save_handler needs to be set before being used
            el_nav_save.save_handler = null;
        }
    };

    const el_cancel_click_handler = function () {
        // for safety, save_handler needs to be set before being used
        el_nav_save.save_handler = null;
        el_view_config_password.value = ""; // for safety
        toggle_nav_init();
        toggle_section(el_view_doc);
    };

    const el_loadlocal_file_change_handler = function () {
        if (el_nav_loadlocal_file.files.length > 0) {
            var file_reader = new FileReader();
            file_reader.onload = function () {
                el_view_doc_text.value = file_reader.result;
            };
            file_reader.readAsText(el_nav_loadlocal_file.files[0])
        }
    };

    const el_textarea_edit_handler = function (e) {
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
                    set_local(LOCAL_STORAGE_KEY, text);
                }
            });
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
                    item.el.style[item.prop_name] = item.timing_callback(item.from, item.to, item.duration, item.elapsed);
                }
            }
            requestAnimationFrame(animation_loop);
        }
        else if (animation_queue.length === 0) {
            animation_time = 0;
        }
    };

    const animate = function (el, prop_name, from, to, duration, timing_callback, finished_callback) {
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
        animation_item.timing_callback = timing_callback;
        animation_item.finished_callback = finished_callback;

        el.style[prop_name] = from;

        if (animation_queue.length === 1) {
            requestAnimationFrame(animation_loop);
        }
    };
    /* #endregion */

    const show_saved_to_local_storage = function() {
        el_popover_message.innerHTML = "Saved to Local Storage";
        show(el_popover_message);
        center(el_popover_message);
        // animate opacity from 1 to 0 over 1.5 seconds
        animate(el_popover_message, "opacity", 1, 0, 1500, lerp_number, function(){ hide(el_popover_message); });
    };

    const start_function = function () {
        sections.push(el_view_doc = dom_query("#view_doc"));
        sections.push(el_view_authenticate = dom_query("#view_authenticate"));
        sections.push(el_view_savelocal = dom_query("#view_savelocal"));
        nav.push(el_nav_authenticate = dom_query("#nav_authenticate"));
        nav.push(el_nav_loadlocal = dom_query("#nav_loadlocal"));
        nav.push(el_nav_savelocal = dom_query("#nav_savelocal"));
        nav.push(el_nav_save = dom_query("#nav_save"));
        nav.push(el_nav_cancel = dom_query("#nav_cancel"));
        el_nav_loadlocal_file = dom_query("input", el_nav_loadlocal);
        el_view_doc_text = dom_query("#view_doc_text");
        el_view_authenticate_password = dom_query("#view_authenticate_password");
        el_view_savelocal_filename = dom_query("#view_savelocal_filename");
        el_view_savelocal_password = dom_query("#view_savelocal_password");
        el_popover_message = dom_query("#popover_message");
        
        hide(el_popover_message);
        toggle_nav_init();
        toggle_section(el_view_doc);

        //add_click_handler(el_nav_authenticate, el_authenticate_click_handler);
        add_click_handler(el_nav_savelocal, el_savelocal_click_handler);
        add_click_handler(el_nav_save, el_save_click_handler);
        add_click_handler(el_nav_cancel, el_cancel_click_handler);
        add_change_handler(el_nav_loadlocal_file, el_loadlocal_file_change_handler);
        add_change_handler(el_view_doc_text, el_textarea_edit_handler);
        add_keydown_handler(el_view_doc_text, el_textarea_edit_handler);
        add_paste_handler(el_view_doc_text, el_textarea_edit_handler);

        interval_id = setInterval(timer_tick_handler, GLOBAL_INTERVAL_MILLISECONDS);

        const stored_value = get_local(LOCAL_STORAGE_KEY);
        if (stored_value) {
            el_view_doc_text.value = stored_value;
        }
    };

    return {
        start: start_function
    };

})();
