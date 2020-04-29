const Test = (function(){
    "use strict"

    const _registered_tests = [];
    let _test_result_container;
    let _success_count = 0;
    let _failure_count = 0;

    const _test_write_success = function(test_name) {
        _success_count++;
        if (_test_result_container) {
            let el = document.createElement("li");
            el.innerHTML = "PASSED: " + test_name;
            el.classList.add("green");
            _test_result_container.append(el);
        }
    };

    const _test_write_failure = function(test_name, message) {
        _failure_count++;
        if (_test_result_container) {
            let el = document.createElement("li");
            el.innerHTML = "FAILURE: " + test_name + "<br />" + message;
            el.classList.add("red");
            _test_result_container.append(el);
        }
    };

    const _test_runner = function(test_name, test_lambda) {
        return (new Promise((resolve, reject) => {
            try {
                let ret = test_lambda();
                if (typeof ret === "object" && ret.constructor === Promise) {
                    ret.then(() => resolve({name: test_name, error: ""}));
                    ret.catch(ex => reject({name: test_name, error: ex}));
                } else {
                    resolve({name: test_name, error: ""});
                }
            } catch (ex) {
                reject({name: test_name, error: ex});
            }
        }))
        .then(success_result => {
            _test_write_success(success_result.name);
        }, error_result => {
            _test_write_failure(error_result.name, error_result.error);
        });
    };

    const _test_assert_equals = function(id, expected, actual) {
        if (expected !== actual) {
            throw "test id: " + id + " expected: " + expected + " actual: " + actual;
        }
    };

    return {
         assert_equals: _test_assert_equals
        ,set_result_container: el => { _test_result_container = el; }
        ,register_test: (test_name, test_proc) => _registered_tests.push({ name: test_name, proc: test_proc })
        ,run_tests: async function() {
            _success_count = 0;
            _failure_count = 0;
            for (let i = 0; i < _registered_tests.length; i++) {
                let test = _registered_tests[i];
                await _test_runner(test.name, test.proc);
            }
        }

        // run_tests is successful if tests did run and were successful
        // and the failure count is 0
        ,all_passed: () => _success_count > 0 && _failure_count === 0
    };

})();