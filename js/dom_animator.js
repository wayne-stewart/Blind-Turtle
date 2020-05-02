const DomAnimator = (function(_) {

    let animation_queue = [],   // items that are currently animating
        animation_time = 0      // animation timestamp, 0 means animation not running

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
                    _.remove(animation_queue, item);
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
        if (!_.is_instantiated(animation_item)) {
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

    const INTERPOLATERS = {
        LERP_NUMBER: lerp_number
    };

    return {
        animate: animate,
        INTERPOLATERS: INTERPOLATERS
    };
})(Utility);