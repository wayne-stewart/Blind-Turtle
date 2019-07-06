const App = (function() {
    "use strict"
    
    const LOCAL_STORAGE_KEY = "secpad_data";

    let sections = [],
        nav = [],
        timer,
        edit_countdown = 0,
        edit_dirty = false,
        el_loadlocal,
        el_loadlocal_file,
        el_savelocal,
        el_save,
        el_cancel,
        el_textarea,
        el_filename,
        el_filename_input;

    const show_section = function(num) {
        for(let i = 0; i < sections.length; i++) {
            if (i === num-1) {
                sections[i].style.display = "block";
            } else {
                sections[i].style.display = "none";
            }
        }
    };

    const dom_query = function(selector, el) {
        if (el) {
            return el.querySelector(selector);
        } else {
            return document.querySelector(selector);
        }
    };

    const add_event_listener = function(el, event_name, handler) {
        el.addEventListener(event_name, handler);
    };

    const add_click_handler = function(el, handler) {
        add_event_listener(el, "click", handler);
    };

    const add_change_handler = function(el, handler) {
        add_event_listener(el, "change", handler);
    };

    const add_keydown_handler = function(el, handler) {
        add_event_listener(el, "keydown", handler)
    };

    const add_paste_handler = function(el, handler) {
        add_event_listener(el, "paste", handler);
    };

    const get_local = function(key) {
        return localStorage.getItem(key);
    };

    const set_local = function(key, value) {
        localStorage.setItem(key, value);
    };

    const toggle_nav = function(/* variable number of nav element arguments */) {
        for(let i = 0; i < nav.length; i++) {
            nav[i].style.display = "none";
        }
        for (let i = 0; i < arguments.length; i++) {
            arguments[i].style.display = "inline-block"
        }
    };

    const toggle_nav_init = function() {
        toggle_nav(el_loadlocal, el_savelocal);
    };

    const el_savelocal_click_handler = function() {
        el_filename_input.value = "";
        toggle_nav(el_filename, el_save, el_cancel);
        el_filename_input.focus();
        el_save.save_handler = function() {
            let filename = el_filename_input.value;
            if (filename.length === 0) {
                filename = "secpad.dat"
            }
            const file = new File([el_textarea.value], filename, { type: "text/plain; charset=utf=8" });
            saveAs(file);
            toggle_nav_init();
        };
    };

    const el_save_click_handler = function() {
        if (typeof el_save.save_handler == "function") {
            el_save.save_handler();
        }
    };

    const el_cancel_click_handler = function() {
        toggle_nav_init();
    };

    const el_loadlocal_file_change_handler = function () {
        if (el_loadlocal_file.files.length > 0) {
            var file_reader = new FileReader();
            file_reader.onload = function() {
                el_textarea.value = file_reader.result;
            };
            file_reader.readAsText(el_loadlocal_file.files[0])
        }
    };

    const el_textarea_edit_handler = function() {
        edit_countdown = 5;
        edit_dirty = true;
    };

    const timer_tick_handler = function() {
        if (edit_countdown > 0) {
            edit_countdown -= 1;
        }
        if (edit_countdown == 0 && edit_dirty) {
            edit_dirty = false;
            set_local(LOCAL_STORAGE_KEY, el_textarea.value);
        }
    };

    const start_function = function() {
        nav.push(el_loadlocal = dom_query("#loadlocal"));
        el_loadlocal_file = dom_query("input", el_loadlocal);
        nav.push(el_savelocal = dom_query("#savelocal"));
        nav.push(el_save = dom_query("#save"));
        nav.push(el_cancel = dom_query("#cancel"));
        el_textarea = dom_query("#txtarea");
        nav.push(el_filename = dom_query("#filename"));
        el_filename_input = el_filename.querySelector("input");

        toggle_nav_init();

        add_click_handler(el_savelocal, el_savelocal_click_handler);
        add_click_handler(el_save, el_save_click_handler);
        add_click_handler(el_cancel, el_cancel_click_handler);
        add_change_handler(el_loadlocal_file, el_loadlocal_file_change_handler);
        add_change_handler(el_textarea, el_textarea_edit_handler);
        add_keydown_handler(el_textarea, el_textarea_edit_handler);
        add_paste_handler(el_textarea, el_textarea_edit_handler);

        timer = setInterval(timer_tick_handler, 1000);

        const stored_value = get_local(LOCAL_STORAGE_KEY);
        if (stored_value) {
            el_textarea.value = stored_value;
        }
    };

    return {
        start: start_function
    };

})();
