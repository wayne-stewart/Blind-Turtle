const App = (function (_, log, tests, crypto, UI, model) {
    "use strict"

    /* #region GLOBAL STATE */
    const GITHUB_REPO_URL = "https://api.github.com/repos";
    const LOCAL_STORAGE_CONFIG_KEY = "__config__";
    const EDIT_COUNTDOWN_TO_SAVE = 2;
    const GLOBAL_INTERVAL_MILLISECONDS = 1000;

    /* application state */
    let docs = [],              // the current open documents
        edit_countdown = 0,
        animation_queue = [],   // items that are currently animating
        animation_time = 0,     // animation timestamp, 0 means animation not running
        master_password = ""
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
        if (!is_instantiated(animation_item)) {
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

        // animation loop is not running when animation_time is 0, so we should start it
        if (animation_time === 0) {
            requestAnimationFrame(animation_loop);
        }
    };
    /* #endregion */

    /* #region MESSAGES */
    const show_popover_message = function(message, cssclass, duration) {
        const el = _.query("#popover_message", app_view_root);
        el.innerHTML = message;
        el.className = cssclass;
        _.show(el);
        _.center(el);
        // animate opacity from 1 to 0 over 1.5 seconds
        animate(el, "opacity", 1, 0, duration, lerp_number, function(){ hide(el); });
    };

    const show_saved_to_local_storage = function() {
        show_popover_message("Saved to Local Storage", "green", 1500);
    };
    /* #endregion */

    const app_start = async function () {

        tests.set_result_container(_.query("#test_container"))
        await tests.run_tests();
        
        if (tests.all_passed()) {
            

            var ui = new UI();
            ui.start();
    
            //setInterval(interval_timer_callback, GLOBAL_INTERVAL_MILLISECONDS);
        }
    };

    _.ready(app_start);

})(Utility, Log, Test, CryptoModule, UIRender_Version_1, Model);
