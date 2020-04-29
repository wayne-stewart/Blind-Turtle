const UIRender_Version_1 = (function(_, model){

    let control_id = 100;
    let nav = []; // the navigation stack
    let app_view_root = null;

    const create_control_id = function() {
        return "_" + (control_id++).toString();
    };

    const render = function(/* variable number of arguments */) {
        // state machine
        let state = 0;
        let arg_index = 0;
        let arg = arguments[arg_index++];
        let el = null;

        while(_.is_instantiated(arg))
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
                    if (_.is_elementnode(arg)) {
                        state = 1;
                        el = arg;
                        el.innerHTML = "";
                    }
                    else if (_.is_string(arg)) {
                        state = 2;
                        el = document.createElement(arg);
                    }
                    else {
                        "First argument must be a dom element or tag name";
                    }
                    break;
                
                // state 1: append all nodes to the root node
                case 1:
                    if (_.is_elementnode(arg)) {
                        el.appendChild(arg);
                    }
                    else {
                        throw "Argument must be a dom element";
                    }
                    break;
                
                // state 2: we are modifying the node we created initially
                case 2:
                    if (_.is_string(arg)) {
                        el.innerHTML = arg;
                    }
                    else if (_.is_array(arg)) {
                        _.each(arg, item => el.appendChild(item));
                    }
                    else if (_.is_object(arg)) {
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
        if (!_.is_instantiated(size)) size = 1;
        switch(size) {
            case 1:
                return render("div", {className: "nav_spacer"}, "&nbsp;");
            case 2:
                return render("div", {className: "nav_spacer_double"}, "&nbsp;<br />&nbsp;");
        }
    };

    const form_input = function(options) {
        if (!_.is_instantiated(options.id)) {
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

    const template = function(template_name) {
        return _.query("template#" + template_name).innerHTML;
    };

    const push_nav = function(controller) {
        nav.push(controller);
        controller.view(app_view_root);
        _.try_focus(_.query("input[autofocus]"));
    };

    const pop_nav = function() {
        nav.pop();
        destroy_default_handlers(app_view_root);
        _.careful_call(_.last(nav), "view", [app_view_root]);
    };

    const pop_nav_all = function() {
        while(nav.length > 0) pop_nav();
    };

    const create_default_handlers = function(el, enter, esc) {
        el.default_keyup_handler = function(e) {
            if (_.is_enter_key(e) && _.is_function(enter)) {
                enter(e);
            } 
            else if (_.is_esc_key(e) && _.is_function(esc)) {
                esc(e);
            }
        };
        _.add_listener(el, "keyup", el.default_keyup_handler);
    };

    const destroy_default_handlers = function(el) {
        if (_.is_function(el.default_keyup_handler)) {
            _.remove_listener(el, "keyup", el.default_keyup_handler);
            el.default_keyup_handler = null;
        }
    };

    const interval_timer_callback = function() {
        if (edit_countdown > 0) {
            edit_countdown -= 1;
        }
        if (edit_countdown == 0) {
            _.each(docs, async doc => {
                if (await doc.has_changed()) {
                    await doc.save_to_local_storage();
                }
            });
        }
    };

    const InitController = function() {
        this.view = function(root) {
            render(root, render("nav", [
                //nav_button("Connect Github", e => push_nav(new ConnectGithubController())),
                nav_button("Connect AWS S3", e => push_nav(new ConnectAWS_S3_Controller())),
                nav_button("Deauthorize", e => {}),
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
                        const plain_text = await crypto.decrypt(password, cipher_text);
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
                    let ciphertext = await crypto.encrypt(password, doc.get_text());
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
                render("p", { className: "textblock" }, template("view_master_password_text")),
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

    const ConnectAWS_S3_Controller = function() {
        let view_root = null;
        let master_password = "";
        let config = {
            type: "aws_s3_iam",
            region: "",
            access_key_id: "",
            access_key_secret: "",
            bucket_name: ""
        };
        const authenticate_handler = async function() {

            clear_validation(view_root);
            if (await validate(view_root)) {

            }
        };
        const cancel_handler = pop_nav;
        this.view = function(root) {
            view_root = root;
            create_default_handlers(app_view_root, authenticate_handler, cancel_handler);
            render(root,
                render("nav", [
                    nav_button("Connect", authenticate_handler),
                    nav_button("Cancel", cancel_handler)]),
                nav_spacer(),
                form_password({
                    id: "password",
                    placeholder: "Master Password",
                    autofocus: true,
                    onchange: e => { master_password = e.target.value; },
                    validators: [new RequiredValidator("Master Password is required.")]}),
                form_password({
                    placeholder: "Confirm Master Password",
                    validators: [new ConfirmIdenticalValuesValidator("#password", "Passwords do not match!")]}),
                render("p", { className: "textblock" }, template("view_master_password_text")),
                form_input({
                    placeholder: "Region",
                    onchange: e => { config.region = e.target.value; },
                    validators: [new RequiredValidator("Region is required.")]}),
                form_input({
                    placeholder: "Access Key ID",
                    onchange: e => { config.access_key_id = e.target.value; },
                    validators: [new RequiredValidator("Access Key ID is required.")]}),
                form_password({
                    placeholder: "Access Key Secret",
                    onchange: e => { config.access_key_secret = e.target.value; },
                    validators: [new RequiredValidator("Access Key Secret is required.")]}),
                form_input({
                    placeholder: "Bucket Name",
                    onchange: e => { config.bucket_name = e.target.value; },
                    validators: [new RequiredValidator("Bucket Name is required.")]}),
                render("p", { className: "textblock error" }));
        };
    };

    const set_validation_error = function(id, view_root, message) {
        _.query("#" + id).classList.add("error");
        _.query("#" + id + " + span", view_root).innerHTML = message;
    };

    const clear_validation = function(root) {
        _.each(_.query_all("input.error", root), el => el.classList.remove("error"));
        _.each(_.query_all("span.error", root), el => el.innerHTML = "");
        _.each(_.query_all("p.error", root), el => el.innerHTML = "");
    };

    const validate = function (el_container) {
        return new Promise((resolve, reject) => {
            let is_valid = true;
            _.each(_.query_all("input", el_container), el => {
                let el_is_valid = true;
                if (el.validators && el.validators.length > 0) {
                    _.each(el.validators, validator => {
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
            if (!_.is_instantiated(el.validators)) {
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
            let el = _.query(selector);
            if (el.value === this.value) {
                return true;
            } else {
                return false;
            }
        };
    };



    var _UI_ = function() {
        this.start = function() {
            app_view_root = document.body;
            if (model.config_exists()) {
                push_nav(new AuthenticateController());
            } else {
                push_nav(new InitController());
            }
        };
    };

    return _UI_;

})(Utility, Model);