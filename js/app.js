
const App = (function() {
    "use strict"

    const dom = {};

    const start_function = function() {
        //document.body.innerHTML = "app start";
        dom.btn_create = document.getElementById("btn_create");
        dom.btn_loadlocal = document.getElementById("btn_loadlocal");
        dom.sec_1 = document.getElementById("sec_1");
        dom.sec_2 = document.getElementById("sec_2");

        dom.sec_2.style.display = "none";
        dom.btn_create.addEventListener("click", function() {
            dom.sec_1.style.display = "none";
            dom.sec_2.style.display = "block"
        });
        dom.btn_loadlocal.addEventListener("click", function() { 

        });
    };

    return {
        start: start_function
    };

})();