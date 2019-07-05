const App = (function() {
    "use strict"

    let btn_create, 
        btn_loadlocal,
        btn_savelocal,
        txt_area;
    
    const sections = [];

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
            el.querySelector(selector);
        } else {
            return document.querySelector(selector);
        }
    };

    const add_click_handler = function(el, handler) {
        el.addEventListener("click", handler);
    };

    const get_local = function(key) {
        localStorage.getItem(key);
    };

    const set_local = function(key, value) {
        localStorage.setItem(key, value);
    };

    const start_function = function() {
        btn_create = dom_query("#btn_create");
        btn_loadlocal = dom_query("#btn_loadlocal");
        btn_savelocal = dom_query("#btn_savelocal");
        sections.push(dom_query("#sec_1"));
        sections.push(dom_query("#sec_2"));
        sections.push(dom_query("#sec_3"));
        txt_area = dom_query("#txt_area");

        show_section(1);
        add_click_handler(btn_create, function() {
            show_section(2);
        });
        add_click_handler(btn_loadlocal, function() {
            show_section(3);
        });
        add_click_handler(btn_savelocal, function() {
            var file = new File([txt_area.value], "localfile.txt", { type: "text/plain; charset=utf=8" });
            saveAs(file);
        });
    };

    return {
        start: start_function
    };

})();
