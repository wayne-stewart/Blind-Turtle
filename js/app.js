const App = (function () {
    "use strict"

    /* #region GLOBAL STATE */
    const GITHUB_REPO_URL = "https://api.github.com/repos";
    const LOCAL_STORAGE_CONFIG_KEY = "__secpad_config_";
    const EDIT_COUNTDOWN_TO_SAVE = 2;
    const GLOBAL_INTERVAL_MILLISECONDS = 1000;

    /* application state */
    let nav = [],               // the navigation stack
        docs = [],              // the current open documents
        app_view_root = null,
        edit_countdown = 0,
        animation_queue = [],   // items that are currently animating
        animation_time = 0,     // animation timestamp, 0 means animation not running
        control_id = 100,
        master_password = ""
    /* #endregion */

    /* #region LOGGING */
    const log = message => {
        if (is_instantiated(console) && is_instantiated(console.log)) {
            console.log(message);
        }
    };
    /* #endregion */

    /* #region CRYPTO */
    const concatenate_buffers = function(/* buffer list */) {
        let length = 0;
        each(arguments, arg => { length += arg.byteLength; });
        let buffer = new ArrayBuffer(length);
        let buffer_view = new Uint8Array(buffer);
        let index = 0;
        each(arguments, item => { for (let i = 0; i < item.length; i++) { 
            buffer_view[index] = item[i];
            index++;
        }});
        return buffer;
    };

    /*  hash_string_sha256
        argument[0]: string to be hashed
        returns: promise with arraybuffer as result*/
    const hash_string_sha256 = function(to_be_hashed) {
        return crypto.subtle.digest("SHA-256", string_to_buffer(to_be_hashed))
    };

    const encrypt_string_to_base64 = async function(password, plaintext) {
        // const sjcl_parameters = { mode: "gcm", ts: 128, adata: "secpad-auth", iter: 15000 };
        // return sjcl.encrypt(password, text, sjcl_parameters);
        let input_buffer = string_to_buffer(plaintext);
        return await encrypt_aes_gcm(password, input_buffer)
            .then(output_buffer => StringView.bytesToBase64(new Uint8Array(output_buffer)));
    };

    const decrypt_base64_to_string = async function(password, base64_data) {
        // return sjcl.decrypt(password, cipher);
        let input_buffer = StringView.base64ToBytes(base64_data);
        return await decrypt_aes_gcm(password, input_buffer.buffer)
            .then(output_buffer => buffer_to_string(output_buffer));
    };

    const create_encrypt_info = async function(password, iv, salt) {
        if (!is_instantiated(iv)) {
            iv = crypto.getRandomValues(new Uint8Array(12));
        }
        if (!is_instantiated(salt)) {
            salt = crypto.getRandomValues(new Uint8Array(16));
        }
        const aes_param = { 
            name: "AES-GCM", 
            iv: iv,
            additionalData: string_to_buffer("secpad-auth"), 
            tagLength: 128,     // tag length in bits
            length: 256         // key length in bits
        };
        password = string_to_buffer(password);
        const pbkdf2_param = {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: salt,
            iterations: 300143
        };
        const key_material = await crypto.subtle.importKey(
            "raw",                          // foramt
            password,
            pbkdf2_param,                   // uses { name: 'value' }
            false,                          // extratable
            ["deriveBits", "deriveKey"]);   // usages
        const key = await crypto.subtle.deriveKey(
            pbkdf2_param,
            key_material,
            aes_param,
            false,                           // extractable
            ["encrypt", "decrypt"]);         // usages
        
        return {
            aes: aes_param,
            pbkdf2: pbkdf2_param,
            key: key
        };
    };

    // the CryptoKey api isn't supported on Safari or IE at this time
    const encrypt_aes_gcm = async function(password, input_buffer) {
        const info = await create_encrypt_info(password);
        const encrypted_data = await crypto.subtle.encrypt(
            info.aes,
            info.key,
            input_buffer);
        const version = new Uint8Array([1]);
        const output_buffer = concatenate_buffers(
            version, 
            info.aes.iv, 
            info.pbkdf2.salt, 
            new Uint8Array(encrypted_data));
        return output_buffer;
    };

    const decrypt_aes_gcm = async function(password, input_buffer) {
        const version = new Uint8Array(input_buffer, 0, 1);
        const iv = new Uint8Array(input_buffer, 1, 12);
        const salt = new Uint8Array(input_buffer, 13, 16);
        const encrypted_data = new Uint8Array(input_buffer, 29);
        if (version[0] !== 1) {
            throw "Invalid Version: " + version[0] + " Expected: 1";
        }
        const info = await create_encrypt_info(password, iv, salt); 
        const output_buffer = await crypto.subtle.decrypt(
            info.aes,
            info.key,
            encrypted_data);
        return output_buffer;
    };
    /* #endregion */

    /* #region UTIL */
    const is_object         = obj => (typeof obj === "object" && obj !== null);
    const is_function       = obj => (typeof obj === "function");
    const is_instantiated   = obj => !(obj === null || typeof obj === "undefined");
    const is_elementnode    = obj => (is_object(obj) && obj.nodeType === document.ELEMENT_NODE);
    const is_string         = obj => (typeof obj === "string");
    const is_string_valid   = obj => (is_string(obj) && obj.length > 0);
    const is_boolean        = obj => (typeof obj === "boolean");
    const is_array          = obj => (is_object(obj) && obj.constructor === Array);
    const swap              = (array, i, j) => { let temp = array[i]; array[i] = array[j]; array[j] = temp; };
    const each              = (array, callback) => { for (let i = 0; i < array.length; i++) callback(array[i], i, array); };
    const remove            = (array, item) => { for(let i = 0; i < array.length; i++) { if (array[i] === item) { swap(array, i, array.length - 1);array.pop();}}};
    const skip              = (array, count) => array.slice(count);
    const first             = array => array[0];
    const last              = array => array[array.length-1];
    const query             = (selector, el) => is_instantiated(el) ? el.querySelector(selector) : document.querySelector(selector);
    const query_all         = (selector, el) => is_instantiated(el) ? el.querySelectorAll(selector) : document.querySelectorAll(selector);
    const add_listener      = (el, event, listener) => el.addEventListener(event, listener, false);
    const remove_listener   = (el, event, listener) => el.removeEventListener(event, listener);
    const string_to_buffer  = string => (new TextEncoder()).encode(string).buffer;
    const buffer_to_string  = buffer => (new TextDecoder("utf-8", {fatal:true})).decode(buffer);
    const buffer_to_hex     = buffer => Array.prototype.map.call(new Uint8Array(buffer), x=>("00" + x.toString(16)).slice(-2)).join('');
    const hex_to_buffer     = hex => { const buffer = new Uint8Array(hex.length / 2); for (let i = 0, j = 0; i < hex.length; i+=2, j++) buffer[j] = "0123456789abcdef".indexOf(hex[i]) * 16 + "0123456789abcdef".indexOf(hex[i+1]); return buffer.buffer; };
    const string_to_hex     = string => buffer_to_hex(string_to_buffer(string));
    const try_focus         = el => is_elementnode(el) ? el.focus() : null;
    const is_enter_key      = e => (e.key === "Enter");
    const is_esc_key        = e => (e.key === "Escape");
    const careful_call      = (obj,fname,farg) => { if (is_instantiated(obj) && is_function(obj[fname])) obj[fname].apply(obj, farg); };

    const center = function(el, center_on) {
        if (!is_instantiated(center_on)) {
            center_on = app_view_root;
        }
        el.style.top = center_on.style.top + center_on.clientHeight / 2 - el.clientHeight / 2;
        el.style.left = center_on.style.left + center_on.clientWidth / 2 - el.clientWidth / 2;
    };

    const show = function(el) {
        if (el.style.display === "none") {
            if (el.style.old_display) {
                el.style.display = el.style.old_display;
            } else {
                el.style.display = "inline-block";
            }
        }
    };

    const hide = function(el) {
        if (el.style.display !== "none") {
            el.style.old_display = el.style.display;
            el.style.display = "none";
        }
    };
    /* #endregion */

    /* #region UI RENDERING, CONTROLS */
    const create_control_id = function() {
        return "_" + (control_id++).toString();
    };

    const render = function(/* variable number of arguments */) {
        // state machine
        let state = 0;
        let arg_index = 0;
        let arg = arguments[arg_index++];
        let el = null;

        while(is_instantiated(arg))
        {
            switch(state)
            {
                // initial state, we are testing the first argument
                // if it is an element node, then we are appending
                // all subsequent nodes as children to the first node
                // if it is a string, we treat it as a tag name and
                // create an element from it. in this case, subsequent
                // arguments will be modifying this node.
                case 0:
                    if (is_elementnode(arg)) {
                        state = 1;
                        el = arg;
                        el.innerHTML = "";
                    }
                    else if (is_string(arg)) {
                        state = 2;
                        el = document.createElement(arg);
                    }
                    else {
                        "First argument must be a dom element or tag name";
                    }
                    break;
                
                // state 1: append all nodes to the root node
                case 1:
                    if (is_elementnode(arg)) {
                        el.appendChild(arg);
                    }
                    else {
                        throw "Argument must be a dom element";
                    }
                    break;
                
                // state 2: we are modifying the node we created initially
                case 2:
                    if (is_string(arg)) {
                        el.innerHTML = arg;
                    }
                    else if (is_array(arg)) {
                        each(arg, item => el.appendChild(item));
                    }
                    else if (is_object(arg)) {
                        for (let property in arg) {
                            el[property] = arg[property];
                        }
                    }
                    else {
                        throw "Uknown argument";
                    }
                    break;
            }
            arg = arg = arguments[arg_index++];
        }

        return el;
    };

    const template = function(template_name) {
        return query("template#" + template_name).innerHTML;
    };

    const push_nav = function(controller) {
        nav.push(controller);
        controller.view(app_view_root);
        try_focus(query("input[autofocus]"));
    };

    const pop_nav = function() {
        nav.pop();
        destroy_default_handlers(app_view_root);
        careful_call(last(nav), "view", [app_view_root]);
    };

    const pop_nav_all = function() {
        while(nav.length > 0) pop_nav();
    };

    const nav_button = function(title, click_handler) {
        return render("button", { title: title, onclick: click_handler }, title);
    };

    const tab_button = function(title, is_active, click_handler) {
        const opts = {
            title: title,
            onclick: click_handler,
            className: is_active ? "active" : ""
        };
        return render("button", opts, title);
    };

    const nav_spacer = function(size) {
        if (!is_instantiated(size)) size = 1;
        switch(size) {
            case 1:
                return render("div", {className: "nav_spacer"}, "&nbsp;");
            case 2:
                return render("div", {className: "nav_spacer_double"}, "&nbsp;<br />&nbsp;");
        }
    };

    const form_input = function(options) {
        if (!is_instantiated(options.id)) {
            options.id = create_control_id();
        }
        return render("div", { className: "form-control" }, [
            render("input", options),
            render("span", { className: "error" })
        ]);
    };

    const form_password = function(options) {
        options.type = "password";
        return form_input(options);
    };

    const form_file = function(options) {
        options.type = "file";
        return form_input(options);
    };
    /* #endregion */

    /* #region MODEL */
    const config_exists = function() {
        for(let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i) === LOCAL_STORAGE_CONFIG_KEY) {
                return true;
            }
        }
        return false;
    };

    const save_config = async function(config) {
        const password = get_master_password();
        const stringified = JSON.stringify(config);
        const encrypted_value = await encrypt_string_to_base64(password, stringified);
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, encrypted_value);
    };

    const load_config = async function() {
        try {
            const password = get_master_password();
            const encrypted_value = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
            const decrypted_value = await decrypt_base64_to_string(password, encrypted_value);
            return JSON.parse(decrypted_value);
        }
        catch(ex) {
            return false;
        }
    };

    const get_master_password = function() {
        return master_password;
    };

    const set_master_password = function(password) {
        master_password = password;
    };
    
    const get_active_doc = function() {
        let active_doc = null;
        each(docs, doc => { if (doc.get_active()) active_doc = doc; });
        if (!is_instantiated(active_doc)) {
            active_doc = first(docs);
            if (is_instantiated(active_doc)) {
                active_doc.set_active(true);
            }
        }
        return active_doc;
    };

    const set_active_doc = function(doc) {
        each(docs, doc => doc.set_active(false));
        doc.set_active(true);
    };

    const doc_exists = function() {
        return docs.length > 0;
    };

    const add_doc = function(name, text) {
        docs.push(new DocModel(name, text));
        set_active_doc(last(docs));
    };

    const DocModel = function(name, text) {
        let _name = name;
        let _text = text;
        let _text_loaded = false;
        let _isactive = false;
        let _edit_dirty = false;
        let _saved_hash = null;

        let _hash_text = async () => buffer_to_hex(await hash_string_sha256(_text));

        this.set_name = name => _name = name;
        this.get_name = () => _name;
        this.set_text = text => { _text = text; _edit_dirty = true; _text_loaded = true; }
        this.get_text = () => _text;
        this.set_active = active => _isactive = active;
        this.get_active = () => _isactive;
        this.edit_dirty = () => _edit_dirty;

        this.has_changed = async function() {
            if (_edit_dirty) {
                const hash = await _hash_text();
                if (_saved_hash === hash) {
                    _edit_dirty = false;
                    return true;
                }
            }
            return false;
        };

        this.save_to_local_storage = async function() {
            let password = get_master_password();
            if (password) {
                let encrypted_text = await encrypt_string_to_base64(password, _text);
                localStorage.setItem(_name, encrypted_text);
                show_saved_to_local_storage();
            }
            else {
                localStorage.setItem(_name, _text);
                show_saved_to_local_storage();
            }
            _edit_dirty = false;
            _saved_hash = await _hash_text();
        };
    };

    const github_call = function(url, method, username, password) {
        let request = new Request(url);
        let headers = new Headers();
        headers.append("Accept", "application/vnd.github.v3+json");
        headers.append("Authorization", "Basic " + btoa(username + ":" + password));
        let config = {
            method: method.toUpperCase(),
            headers: headers,
            mode: "cors"
        };
        return fetch(request, config)
            .catch(error => { log("Call to Github failed with error: " + error); });
    };

    const github_authenticate = function(username, password, repo) {
        const url = GITHUB_REPO_URL + "/" + username + "/" + repo;
        return github_call(url, "GET", username, password)
            .then(response => { return response.json(); })
            .then(data => {
                return new Promise((resolve, reject) => {
                try {
                    if (data.id && data.name.toLowerCase() === repo.toLowerCase() && data.permissions.push === true) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch {
                    resolve(false);
                }}); 
            });
    };
    /* #endregion */

    /* #region VIEW CONTROLLERS */

    const InitController = function() {
        this.view = function(root) {
            render(root, render("nav", [
                nav_button("Connect Github", e => push_nav(new ConnectGithubController())),
                nav_button("About", e => push_nav(new AboutController()))
            ]));
        };
    };

    const AuthenticateController = function() {
        let view_root = null;
        let password = "";
        const authenticate_handler = async function() {
            set_master_password(password);
            let config = await load_config();
            if (config) {
                pop_nav_all();
                push_nav(new MainController());
            } else {
                query("p.error", view_root).innerHTML = "Authentication Failed";
            }
        };
        this.view = function(root) {
            view_root = root;
            create_default_handlers(app_view_root, authenticate_handler, null);
            render(root, render("nav", [
                nav_button("Authenticate", authenticate_handler)
            ]),
            nav_spacer(),
            form_password({
                id: "password",
                placeholder: "Password",
                autofocus: true,
                onchange: e => { password = e.target.value; }}),
            render("p", { className: "textblock error" }));
        };
    };

    const ConfigureMasterPassword = function () {
        this.view = function(root) {
            render(root, render("nav", [
                nav_button("Save", () => {}),
                nav_button("Cancel", pop_nav)
            ]));
        };
    };

    const MainController = function() {
        let view_root = null;
        const render_editable_area = function() {
            if (doc_exists()) {
                return render("p", get_active_doc().get_text(), { 
                    className: "editable", 
                    "contentEditable": true,
                    onkeyup: e => { get_active_doc().set_text(e.target.innerHTML); }})
            } else {
                return render("span");
            }
        };
        const render_file_names = function() {
            if (doc_exists()) {
                const  tabs = [];
                each(docs, doc => tabs.push(tab_button(doc.get_name(), doc.get_active(), e => { 
                    set_active_doc(doc); render_view(view_root); })));
                return render("div", tabs);
            } else {
                return render("span");
            }
        };
        const render_view = function(root) {
            view_root = root;
            render(root,
                render("nav", [
                    render("div", [
                        // nav_button("Load from File", e => push_nav(new LoadLocalFileController())),
                        // nav_button("Save to File", e => push_nav(new SaveToLocalFileController())),
                        // nav_button("Configure Github", e => push_nav(new ConnectGithubController())),
                        nav_button("New", e => push_nav(new NewDocController())),
                        nav_button("Save", e => {}),
                        nav_button("About", e => push_nav(new AboutController())),
                    ]),
                    render_file_names()
                ]),
                nav_spacer(doc_exists() ? 2 : 1),
                render_editable_area(),
                render("div", { id: "popover_message" }));
        };
        this.view = render_view;
    };

    const NewDocController = function() {
        let view_root = null;
        let file_name = "";
        const create_handler = async function() {
            clear_validation(view_root);
            if (await validate(view_root)) {
                add_doc(file_name,""); 
                pop_nav();
            }
        };
        const cancel_handler = pop_nav;
        this.view = function(root) {
            view_root = root;
            create_default_handlers(app_view_root, create_handler, cancel_handler);
            render(root,
                render("nav", [
                    nav_button("Create", create_handler),
                    nav_button("Cancel", cancel_handler)
                ]),
                nav_spacer(),
                form_input({
                    placeholder: "File Name",
                    autofocus: true,
                    onchange: e => file_name = e.target.value,
                    validators:[new RequiredValidator("File Name is required.")]}));
        };
    };

    const AboutController = function() {
        this.view = function(root) {
            create_default_handlers(app_view_root, pop_nav, pop_nav);
            render(root, 
                render("nav", [
                    nav_button("Close", pop_nav)
                ]),
                nav_spacer(),
                render("div", { className: "about_view" }, template("view_about")));
        };
    };

    const LoadLocalFileController = function() {
        let view_root = null;
        let password = "";
        let file = null;
        let load_handler = async function() {
            clear_validation(view_root);
            if (await validate(view_root)) {
                const file_reader = new FileReader();
                file_reader.onload = async function() {
                    try {
                        const cipher_text = file_reader.result;
                        const plain_text = await decrypt_base64_to_string(password, cipher_text);
                        add_doc(file.name, plain_text);
                        pop_nav();
                    }
                    catch(ex) {
                        set_validation_error("password", view_root, ex);
                    }
                };
                file_reader.readAsText(file);
            }
        };
        let cancel_handler = pop_nav;
        this.view = function(root) {
            view_root = root;
            create_default_handlers(app_view_root, load_handler, cancel_handler);
            render(root,
                render("nav",[
                    nav_button("Load", load_handler),
                    nav_button("Cancel", cancel_handler)]),
                nav_spacer(),
                form_file({
                    onchange: e => { file = e.target.files[0]; },
                    validators:[new RequiredValidator("A file is required to continue.")]}),
                form_password({
                    placeholder: "Password",
                    onchange: e => { password = e.target.value; }}));
        };
    };

    const SaveToLocalFileController = function() {
        let view_root = null;
        let filename = get_active_doc().get_name();
        let password = "";
        let save_handler = async function() {
            clear_validation(view_root);
            try {
                if (await validate(view_root)) {
                    let doc = get_active_doc();
                    let ciphertext = await encrypt_string_to_base64(password, doc.get_text());
                    doc.set_name(filename);
                    let file = new File([ciphertext], doc.get_name(), { type: "text/plain; charset=utf-8" });
                    saveAs(file);
                    pop_nav();
                }
            }
            catch (ex) {
                set_validation_error("confirm_password", view_root, ex);
            }
        };
        let cancel_handler = pop_nav;
        this.view = function(root) {
            view_root = root;
            create_default_handlers(app_view_root, save_handler, cancel_handler);
            render(root,
                render("nav",[
                    nav_button("Save", save_handler),
                    nav_button("Cancel", cancel_handler)]),
                nav_spacer(),
                form_input({
                    placeholder: "File Name",
                    value: filename,
                    onchange: e => { filename = e.target.value; },
                    validators: [new RequiredValidator("File Name is required.")]}),
                form_password({
                    id: "password",
                    placeholder: "Password",
                    autofocus: true,
                    onchange: e => { password = e.target.value; }}),
                form_password({
                    placeholder: "Confirm Password",
                    validators: [new ConfirmIdenticalValuesValidator("#password", "Passwords do not match!")]}),
                render("p", { className: "textblock" }, template("view_savelocal_text")));
        };
    };

    const ConnectGithubController = function() {
        let view_root = null;
        let master_password = "";
        let config = {
            type: "github",
            username: "",
            password: "",
            reponame: ""
        };
        const authenticate_handler = async function() {
            clear_validation(view_root);
            if (await validate(view_root)) {
                if (await github_authenticate(config.username, config.password, config.reponame)) {
                    set_master_password(master_password);
                    await save_config(config);
                    pop_nav_all();
                    push_nav(new MainController());
                } else {
                    query("p.error", view_root).innerHTML = "Github Validation Failed";
                }
            }
        };
        const cancel_handler = pop_nav;
        this.view = function(root) {
            view_root = root;
            create_default_handlers(app_view_root, authenticate_handler, cancel_handler);
            render(root,
                render("nav", [
                    nav_button("Authenticate", authenticate_handler),
                    nav_button("Cancel", cancel_handler)]),
                nav_spacer(),
                form_password({
                    id: "password",
                    placeholder: "Master Password",
                    autofocus: true,
                    onchange: e => { master_password = e.target.value; }}),
                form_password({
                    placeholder: "Confirm Master Password",
                    validators: [new ConfirmIdenticalValuesValidator("#password", "Passwords do not match!")]}),
                render("p", { className: "textblock" }, template("view_connect_github_text")),
                form_input({
                    placeholder: "Github Username",
                    onchange: e => { config.username = e.target.value; },
                    validators: [new RequiredValidator("Github Username is required.")]}),
                form_password({
                    placeholder: "Github Password",
                    onchange: e => { config.password = e.target.value; },
                    validators: [new RequiredValidator("Github Password is required.")]}),
                form_input({
                    placeholder: "Github Repo Name",
                    onchange: e => { config.reponame = e.target.value; },
                    validators: [new RequiredValidator("Github Repo Name is required.")]}),
                render("p", { className: "textblock error" }));
        };
    };

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
        if (typeof animation_item === "undefined" || animation_item === null) {
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

        if (animation_queue.length === 1) {
            requestAnimationFrame(animation_loop);
        }
    };
    /* #endregion */

    /* #region HANDLERS */

    const create_default_handlers = function(el, enter, esc) {
        el.default_keyup_handler = function(e) {
            if (is_enter_key(e) && is_function(enter)) {
                enter(e);
            } 
            else if (is_esc_key(e) && is_function(esc)) {
                esc(e);
            }
        };
        add_listener(el, "keyup", el.default_keyup_handler);
    };

    const destroy_default_handlers = function(el) {
        if (is_function(el.default_keyup_handler)) {
            remove_listener(el, "keyup", el.default_keyup_handler);
            el.default_keyup_handler = null;
        }
    };

    const interval_timer_callback = function() {
        if (edit_countdown > 0) {
            edit_countdown -= 1;
        }
        if (edit_countdown == 0) {
            each(docs, async doc => {
                if (await doc.has_changed()) {
                    await doc.save_to_local_storage();
                }
            });
        }
    };

    /* #endregion */

    /* #region MESSAGES */
    const show_popover_message = function(message, cssclass, duration) {
        const el = query("#popover_message", app_view_root);
        el.innerHTML = message;
        el.className = cssclass;
        show(el);
        center(el);
        // animate opacity from 1 to 0 over 1.5 seconds
        animate(el, "opacity", 1, 0, duration, lerp_number, function(){ hide(el); });
    };

    const show_saved_to_local_storage = function() {
        show_popover_message("Saved to Local Storage", "green", 1500);
    };
    /* #endregion */

    /* #region VALIDATION */
    const set_validation_error = function(id, view_root, message) {
        query("#" + id).classList.add("error");
        query("#" + id + " + span", view_root).innerHTML = message;
    };

    const clear_validation = function(root) {
        each(query_all("input.error", root), el => el.classList.remove("error"));
        each(query_all("span.error", root), el => el.innerHTML = "");
        each(query_all("p.error", root), el => el.innerHTML = "");
    };

    const validate = function (el_container) {
        return new Promise((resolve, reject) => {
            let is_valid = true;
            each(query_all("input", el_container), el => {
                let el_is_valid = true;
                if (el.validators && el.validators.length > 0) {
                    each(el.validators, validator => {
                        if (!validator.validate.call(el)) {
                            el_is_valid = false;
                            set_validation_error(el.id, el.parentNode, validator.message);
                        }
                    });
                }
                if (el_is_valid) {
                    clear_validation(el.parentNode);
                }
                else {
                    is_valid = false;
                }
            });
            if (is_valid) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    };

    const add_validator = function(el, validator) {
        if (el && validator) {
            if (!is_instantiated(el.validators)) {
                el.validators = [];
            }
            el.validators.push(validator);
        }
    };

    /* the 'this' parameter is the element to validate */
    const RequiredValidator = function(message) {
        this.message = message;
        this.validate = function() { return this.value.length > 0; };
    };

    const ConfirmIdenticalValuesValidator = function(selector, message) {
        this.message = message;
        this.validate = function() {
            let el = query(selector);
            if (el.value === this.value) {
                return true;
            } else {
                return false;
            }
        };
    };
    /* #endregion */

    /* #region TESTS */
    let _test_result_container;
    const _test_ascii_keyboard_characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}\\|;:'\",<.>/?`~ \t";
    const _test_ascii_keyboard_characters_to_hex = "6162636465666768696a6b6c6d6e6f707172737475767778797a4142434445464748494a4b4c4d4e4f505152535455565758595a3031323334353637383921402324255e262a28295f2b2d3d5b5d7b7d5c7c3b3a27222c3c2e3e2f3f607e2009";
    
    const _test_write_success = function(test_name) {
        if (is_instantiated(_test_result_container)) {
            let el = document.createElement("li");
            el.innerHTML = "PASSED: " + test_name;
            el.classList.add("green");
            _test_result_container.append(el);
        }
    };

    const _test_write_failure = function(test_name, message) {
        if (is_instantiated(_test_result_container)) {
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

    const _test_suite = async function(display_root) {
        _test_result_container = display_root;
        await _test_runner("string_to_buffer buffer_to_string", () => {
            let utf8_arraybuffer = string_to_buffer(_test_ascii_keyboard_characters);
            let str = buffer_to_string(utf8_arraybuffer);
            _test_assert_equals(1,_test_ascii_keyboard_characters.length, utf8_arraybuffer.byteLength);
            _test_assert_equals(2,_test_ascii_keyboard_characters, str);
        });

        await _test_runner("buffer_to_hex hex_to_buffer", () => {
            let buffer1 = string_to_buffer(_test_ascii_keyboard_characters);
            let hex_string = buffer_to_hex(buffer1);
            _test_assert_equals(1,_test_ascii_keyboard_characters_to_hex, hex_string);
            let buffer2 = hex_to_buffer(hex_string);
            _test_assert_equals(2,_test_ascii_keyboard_characters.length, buffer2.byteLength);
            let str = buffer_to_string(buffer2);
            _test_assert_equals(3,_test_ascii_keyboard_characters, str);
        });

        await _test_runner("is_instantiated", () => {
            _test_assert_equals(1,true, is_instantiated({}));
            _test_assert_equals(2,true, is_instantiated(1));
            _test_assert_equals(3,true, is_instantiated("an object"));
            _test_assert_equals(4,true, is_instantiated(() => {}));
            _test_assert_equals(5,true, is_instantiated(is_instantiated));
            _test_assert_equals(6,false, is_instantiated(null));
            _test_assert_equals(7,false, is_instantiated(undefined));
        });

        await _test_runner("is_object", () => {
            _test_assert_equals(1,true, is_object({}));
            _test_assert_equals(2,false, is_object(1));
            _test_assert_equals(3,false, is_object("an object"));
            _test_assert_equals(4,false, is_object(null));
            _test_assert_equals(5,false, is_object(undefined));
        });

        await _test_runner("is_function", () => {
            _test_assert_equals(1,true, is_function(is_object));
            _test_assert_equals(2,false, is_function(null));
            _test_assert_equals(3,true, is_function(() => { }));
            _test_assert_equals(4,false, is_function({}));
        });

        await _test_runner("is_elementnode", () => {
            _test_assert_equals(1,true, is_elementnode(document.createElement("div")));
            _test_assert_equals(2,false, is_elementnode(document.createAttribute("id")));
            _test_assert_equals(3,false, is_elementnode(null));
            _test_assert_equals(4,false, is_elementnode({}));
        });

        await _test_runner("is_string and is_string_valid", () => {
            _test_assert_equals(1,true, is_string(""));
            _test_assert_equals(2,true, is_string("asdf"));
            _test_assert_equals(3,false, is_string(null));
            _test_assert_equals(4,false, is_string(undefined));
            _test_assert_equals(5,false, is_string({}));
            _test_assert_equals(6,false, is_string([]));

            _test_assert_equals(7,true, is_string_valid("a"));
            _test_assert_equals(8,false, is_string_valid(""));
            _test_assert_equals(9,false, is_string_valid({}));
            _test_assert_equals(10,false, is_string_valid([]));
            _test_assert_equals(11,false, is_string_valid(null));
            _test_assert_equals(12,false, is_string_valid(undefined));
        });

        await _test_runner("is_boolean", () => {
            _test_assert_equals(1,true, is_boolean(true));
            _test_assert_equals(2,true, is_boolean(false));
            _test_assert_equals(3,true, is_boolean(1 == 1));
            _test_assert_equals(4,false, is_boolean(1));
            _test_assert_equals(5,false, is_boolean(0));
            _test_assert_equals(6,false, is_boolean({}));
            _test_assert_equals(7,false, is_boolean(""));
            _test_assert_equals(8,false, is_boolean("asdf"));
            _test_assert_equals(9,false, is_boolean([]));
        });

        await _test_runner("is_array", () => {
            _test_assert_equals(1,false, is_array(true));
            _test_assert_equals(2,false, is_array(false));
            _test_assert_equals(3,false, is_array(1 == 1));
            _test_assert_equals(4,false, is_array(1));
            _test_assert_equals(5,false, is_array(0));
            _test_assert_equals(6,false, is_array({}));
            _test_assert_equals(7,false, is_array(""));
            _test_assert_equals(8,false, is_array("asdf"));
            _test_assert_equals(9,true, is_array([]));
        });

        await _test_runner("swap", () => {
            let a = [1,2,3,4];
            swap(a, 1, 2);
            _test_assert_equals(1, 3, a[1]);
            _test_assert_equals(2, 2, a[2]);
        });

        await _test_runner("each", () => {
            let a = [1,2,3,4];
            let s = "";
            each(a, item => s += item);
            _test_assert_equals(1, "1234", s);
        });

        await _test_runner("remove", () => {
            let a = [1,2,3,4];
            remove(a, 2);
            _test_assert_equals(1, 1, a[0]);
            _test_assert_equals(2, 4, a[1]);
            _test_assert_equals(3, 3, a[2]);
            _test_assert_equals(4, 3, a.length);
            remove(a, 1);
            _test_assert_equals(5, 2, a.length);
            remove(a, 3);
            _test_assert_equals(6, 1, a.length);
            _test_assert_equals(7, 4, a[0]);
            remove(a, 4);
            _test_assert_equals(8, 0, a.length);
        });

        await _test_runner("skip", () => {
            let a = [1,2,3,4];
            let b = skip(a, 2);
            let s_b = "";
            let s_a = "";
            each(a, item => s_a += item);
            each(b, item => s_b += item);
            _test_assert_equals(1, "1234", s_a);
            _test_assert_equals(2, "34", s_b);
        });

        await _test_runner("first and last", () => {
            let a = [1,2,3,4];
            let b = first(a);
            let c = last(a);
            _test_assert_equals(1, 1, b);
            _test_assert_equals(2, 4, c);
        });

        await _test_runner("query and query_all", () => {
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
            let e = query("p#one");
            let f = query_all("p");
            let g = query(".three", a);
            let h = query_all("span", a);
            _test_assert_equals(1, a, e);
            _test_assert_equals(2, 2, f.length);
            _test_assert_equals(3, "one", f[0].id);
            _test_assert_equals(4, "two", f[1].name);
            _test_assert_equals(5, c, g);
            _test_assert_equals(6, 2, h.length);
            _test_assert_equals(7, "three", h[0].className);
            _test_assert_equals(8, "four", h[1].className);
        });

        await _test_runner("add_listener and remove_listener", () =>{
            let a = document.createElement("input");
            let b = "";
            let handler = e => {
                b += e.key;
            };
            add_listener(a, "keyup", handler);
            let simulate_keyup = function(el, value) {
                var e = new Event("keyup");
                e.key = value;
                el.dispatchEvent(e);
            };
            simulate_keyup(a, "a");
            simulate_keyup(a, "b");
            simulate_keyup(a, "c");
            remove_listener(a, "keyup", handler);
            simulate_keyup(a, "d");
            simulate_keyup(a, "e");
            simulate_keyup(a, "f");
            _test_assert_equals(1, "abc", b);
        });

        await _test_runner("careful_call", () => {
            let a = "";
            let b = "";
            let c = "";
            let d = {
                e: function() { a = "no arg"; },
                f: function(arg1) { b = arg1; },
                g: function(arg1, arg2) { c = arg1 + arg2; }
            };
            careful_call(d, "does_not_exist");
            careful_call(null, "does_not_exist");
            careful_call(d, "e");
            careful_call(d, "f", ["abc"]);
            careful_call(d, "g", ["def", "ghi"]);
            _test_assert_equals(1, "no arg", a);
            _test_assert_equals(2, "abc", b);
            _test_assert_equals(3, "defghi", c);
        });
    };

    //window.run_tests = _test_suite;
    /* #endregion */

    const app_start = function () {

        // _test_suite(query("#test_container"));
        // return;

        app_view_root = document.body;

        if (config_exists()) {
            push_nav(new AuthenticateController());
        } else {
            push_nav(new InitController());
        }

        setInterval(interval_timer_callback, GLOBAL_INTERVAL_MILLISECONDS);
    };

    if (document.readyState === "complete" || document.readyState === "loaded") {
        app_start();
    } else {
        window.addEventListener("DOMContentLoaded", app_start);
    }

})();
