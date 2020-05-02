const App = (function (_, tests, UI, model) {
    "use strict"

    const app_start = async function () {

        tests.set_result_container(_.query("#test_container"))
        await tests.run_tests();
        
        if (tests.all_passed()) {
            

            var ui = new UI();
            model.start();
            ui.start();
        }
    };

    _.ready(app_start);

})(Utility, Test, UIRender_Version_1, Model);
