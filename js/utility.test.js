
(function(_, t) {
    "use strict"

    const _test_ascii_keyboard_characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}\\|;:'\",<.>/?`~ \t";
    const _test_ascii_keyboard_characters_to_hex = "6162636465666768696a6b6c6d6e6f707172737475767778797a4142434445464748494a4b4c4d4e4f505152535455565758595a3031323334353637383921402324255e262a28295f2b2d3d5b5d7b7d5c7c3b3a27222c3c2e3e2f3f607e2009";
    
    t.register_test("string_to_buffer buffer_to_string", () => {
        let utf8_arraybuffer = _.string_to_buffer(_test_ascii_keyboard_characters);
        let str = _.buffer_to_string(utf8_arraybuffer);
        t.assert_equals(1,_test_ascii_keyboard_characters.length, utf8_arraybuffer.byteLength);
        t.assert_equals(2,_test_ascii_keyboard_characters, str);
    });

    t.register_test("buffer_to_hex hex_to_buffer", () => {
        let buffer1 = _.string_to_buffer(_test_ascii_keyboard_characters);
        let hex_string = _.buffer_to_hex(buffer1);
        t.assert_equals(1,_test_ascii_keyboard_characters_to_hex, hex_string);
        let buffer2 = _.hex_to_buffer(hex_string);
        t.assert_equals(2,_test_ascii_keyboard_characters.length, buffer2.byteLength);
        let str = _.buffer_to_string(buffer2);
        t.assert_equals(3,_test_ascii_keyboard_characters, str);
    });

    t.register_test("is_instantiated", () => {
        t.assert_equals(1,true, _.is_instantiated({}));
        t.assert_equals(2,true, _.is_instantiated(1));
        t.assert_equals(3,true, _.is_instantiated("an object"));
        t.assert_equals(4,true, _.is_instantiated(() => {}));
        t.assert_equals(5,true, _.is_instantiated(_.is_instantiated));
        t.assert_equals(6,false, _.is_instantiated(null));
        t.assert_equals(7,false, _.is_instantiated(undefined));
    });

    t.register_test("is_object", () => {
        t.assert_equals(1,true, _.is_object({}));
        t.assert_equals(2,false, _.is_object(1));
        t.assert_equals(3,false, _.is_object("an object"));
        t.assert_equals(4,false, _.is_object(null));
        t.assert_equals(5,false, _.is_object(undefined));
    });

    t.register_test("is_function", () => {
        t.assert_equals(1,true, _.is_function(_.is_object));
        t.assert_equals(2,false, _.is_function(null));
        t.assert_equals(3,true, _.is_function(() => { }));
        t.assert_equals(4,false, _.is_function({}));
    });

    t.register_test("is_elementnode", () => {
        t.assert_equals(1,true, _.is_elementnode(document.createElement("div")));
        t.assert_equals(2,false, _.is_elementnode(document.createAttribute("id")));
        t.assert_equals(3,false, _.is_elementnode(null));
        t.assert_equals(4,false, _.is_elementnode({}));
    });

    t.register_test("is_string and is_string_valid", () => {
        t.assert_equals(1,true, _.is_string(""));
        t.assert_equals(2,true, _.is_string("asdf"));
        t.assert_equals(3,false, _.is_string(null));
        t.assert_equals(4,false, _.is_string(undefined));
        t.assert_equals(5,false, _.is_string({}));
        t.assert_equals(6,false, _.is_string([]));

        t.assert_equals(7,true, _.is_string_valid("a"));
        t.assert_equals(8,false, _.is_string_valid(""));
        t.assert_equals(9,false, _.is_string_valid({}));
        t.assert_equals(10,false, _.is_string_valid([]));
        t.assert_equals(11,false, _.is_string_valid(null));
        t.assert_equals(12,false, _.is_string_valid(undefined));
    });

    t.register_test("is_boolean", () => {
        t.assert_equals(1,true, _.is_boolean(true));
        t.assert_equals(2,true, _.is_boolean(false));
        t.assert_equals(3,true, _.is_boolean(1 == 1));
        t.assert_equals(4,false, _.is_boolean(1));
        t.assert_equals(5,false, _.is_boolean(0));
        t.assert_equals(6,false, _.is_boolean({}));
        t.assert_equals(7,false, _.is_boolean(""));
        t.assert_equals(8,false, _.is_boolean("asdf"));
        t.assert_equals(9,false, _.is_boolean([]));
    });

    t.register_test("is_array", () => {
        t.assert_equals(1,false, _.is_array(true));
        t.assert_equals(2,false, _.is_array(false));
        t.assert_equals(3,false, _.is_array(1 == 1));
        t.assert_equals(4,false, _.is_array(1));
        t.assert_equals(5,false, _.is_array(0));
        t.assert_equals(6,false, _.is_array({}));
        t.assert_equals(7,false, _.is_array(""));
        t.assert_equals(8,false, _.is_array("asdf"));
        t.assert_equals(9,true, _.is_array([]));
    });

    t.register_test("swap", () => {
        let a = [1,2,3,4];
        _.swap(a, 1, 2);
        t.assert_equals(1, 3, a[1]);
        t.assert_equals(2, 2, a[2]);
    });

    t.register_test("each", () => {
        let a = [1,2,3,4];
        let s = "";
        _.each(a, item => s += item);
        t.assert_equals(1, "1234", s);
    });

    t.register_test("remove", () => {
        let a = [1,2,3,4];
        _.remove(a, 2);
        t.assert_equals(1, 1, a[0]);
        t.assert_equals(2, 4, a[1]);
        t.assert_equals(3, 3, a[2]);
        t.assert_equals(4, 3, a.length);
        _.remove(a, 1);
        t.assert_equals(5, 2, a.length);
        _.remove(a, 3);
        t.assert_equals(6, 1, a.length);
        t.assert_equals(7, 4, a[0]);
        _.remove(a, 4);
        t.assert_equals(8, 0, a.length);
    });

    t.register_test("skip", () => {
        let a = [1,2,3,4];
        let b = _.skip(a, 2);
        let s_b = "";
        let s_a = "";
        _.each(a, item => s_a += item);
        _.each(b, item => s_b += item);
        t.assert_equals(1, "1234", s_a);
        t.assert_equals(2, "34", s_b);
    });

    t.register_test("first and last", () => {
        let a = [1,2,3,4];
        let b = _.first(a);
        let c = _.last(a);
        t.assert_equals(1, 1, b);
        t.assert_equals(2, 4, c);
    });

    t.register_test("query and query_all", () => {
        let a = document.createElement("p");
        a.id = "one";
        let b = document.createElement("p");
        b.name = "two";
        let c = document.createElement("span");
        c.className = "three";
        let d = document.createElement("span");
        d.className = "four";
        document.body.append(a);
        document.body.append(b);
        a.append(c);
        a.append(d);
        let e = _.query("p#one");
        let f = _.query_all("p");
        let g = _.query(".three", a);
        let h = _.query_all("span", a);
        t.assert_equals(1, a, e);
        t.assert_equals(2, 2, f.length);
        t.assert_equals(3, "one", f[0].id);
        t.assert_equals(4, "two", f[1].name);
        t.assert_equals(5, c, g);
        t.assert_equals(6, 2, h.length);
        t.assert_equals(7, "three", h[0].className);
        t.assert_equals(8, "four", h[1].className);
    });

    t.register_test("add_listener and remove_listener", () =>{
        let a = document.createElement("input");
        let b = "";
        let handler = e => {
            b += e.key;
        };
        _.add_listener(a, "keyup", handler);
        let simulate_keyup = function(el, value) {
            var e = new Event("keyup");
            e.key = value;
            el.dispatchEvent(e);
        };
        simulate_keyup(a, "a");
        simulate_keyup(a, "b");
        simulate_keyup(a, "c");
        _.remove_listener(a, "keyup", handler);
        simulate_keyup(a, "d");
        simulate_keyup(a, "e");
        simulate_keyup(a, "f");
        t.assert_equals(1, "abc", b);
    });

    t.register_test("careful_call", () => {
        let a = "";
        let b = "";
        let c = "";
        let d = {
            e: function() { a = "no arg"; },
            f: function(arg1) { b = arg1; },
            g: function(arg1, arg2) { c = arg1 + arg2; }
        };
        _.careful_call(d, "does_not_exist");
        _.careful_call(null, "does_not_exist");
        _.careful_call(d, "e");
        _.careful_call(d, "f", ["abc"]);
        _.careful_call(d, "g", ["def", "ghi"]);
        t.assert_equals(1, "no arg", a);
        t.assert_equals(2, "abc", b);
        t.assert_equals(3, "defghi", c);
    });

})(Utility, Test);
