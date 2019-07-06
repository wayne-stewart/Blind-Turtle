const App = (function() {
    "use strict"

    let sections = [],
        nav = [],
        current_state = "init",
        current_local_filename,
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

    const add_click_handler = function(el, handler) {
        el.addEventListener("click", handler);
    };

    const add_change_handler = function(el, handler) {
        el.addEventListener("change", handler);
    };

    const get_local = function(key) {
        return localStorage.getItem(key);
    };

    const set_local = function(key, value) {
        localStorage.setItem(key, value);
    };

    const toggle_nav = function() {
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

        add_click_handler(el_savelocal, function() {
            if (current_local_filename) {
                el_filename_input.value = current_local_filename;
            }
            toggle_nav(el_filename, el_save, el_cancel);
            el_filename_input.focus();
            current_state = "pre_save_local";
        });
        add_click_handler(el_save, function() {
            switch(current_state) {
                case "pre_save_local":
                        let filename = el_filename_input.value;
                        if (filename.length === 0) {
                            filename = "secpad.dat"
                        }
                        const file = new File([el_textarea.value], filename, { type: "text/plain; charset=utf=8" });
                        saveAs(file);
                        toggle_nav_init();
                    break;
            }
        });
        add_click_handler(el_cancel, function() {
            toggle_nav_init();
        });
        add_change_handler(el_loadlocal_file, function() {
            if (el_loadlocal_file.files.length > 0) {
                var file_reader = new FileReader();
                file_reader.onload = function() {
                    el_textarea.value = file_reader.result;
                };
                file_reader.readAsText(el_loadlocal_file.files[0])
                current_local_filename = el_loadlocal_file.files[0].name;
            }
        });
    };

    return {
        start: start_function
    };

})();
