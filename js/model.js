const Model = (function(_, crypto) {
    "use strict"

    const GITHUB_REPO_URL = "https://api.github.com/repos";
    const LOCAL_STORAGE_CONFIG_KEY = "__config__";

    let master_password;
    let docs = [];              // the current open documents

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
        const encrypted_value = await crypto.encrypt(password, stringified);
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, encrypted_value);
    };

    const load_config = async function() {
        try {
            const password = get_master_password();
            const encrypted_value = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
            const decrypted_value = await crypto.decrypt(password, encrypted_value);
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
        _.each(docs, doc => { if (doc.get_active()) active_doc = doc; });
        if (!_.is_instantiated(active_doc)) {
            active_doc = first(docs);
            if (_.is_instantiated(active_doc)) {
                active_doc.set_active(true);
            }
        }
        return active_doc;
    };

    const set_active_doc = function(doc) {
        _.each(docs, doc => doc.set_active(false));
        doc.set_active(true);
    };

    const doc_exists = function() {
        return docs.length > 0;
    };

    const add_doc = function(name, text) {
        docs.push(new DocModel(name, text));
        set_active_doc(_.last(docs));
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
                let encrypted_text = await crypto.encrypt(password, _text);
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

    return {
         config_exists: config_exists
        ,load_config: load_config
        ,doc_exists: doc_exists
        ,add_doc: add_doc
        ,github_authenticate: github_authenticate
        ,set_master_password: set_master_password
        ,save_config: save_config
        ,docs: docs
        ,get_active_doc: get_active_doc
        ,set_active_doc: set_active_doc
    };

})(Utility, CryptoModule);