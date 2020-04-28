const Log = (function(_) {
    "use strict"

    const log = function(value) {
        if (_.is_instantiated(console) && _.is_function(console.log)) {
            console.log(value);
        }
    };

    return log;
})(Utility);