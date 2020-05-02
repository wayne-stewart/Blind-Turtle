const CryptoModule = (function(_){

    const concatenate_buffers = function(/* buffer list */) {
        let length = 0;
        _.each(arguments, arg => { length += arg.byteLength; });
        let buffer = new ArrayBuffer(length);
        let buffer_view = new Uint8Array(buffer);
        let index = 0;
        _.each(arguments, item => { for (let i = 0; i < item.length; i++) { 
            buffer_view[index] = item[i];
            index++;
        }});
        return buffer;
    };

    /*  hash_string_sha256
        argument[0]: string to be hashed
        returns: promise with arraybuffer as result*/
    const hash_string_sha256 = function(to_be_hashed) {
        return crypto.subtle.digest("SHA-256", _.string_to_buffer(to_be_hashed))
    };

    const encrypt_string_to_base64 = async function(password, plaintext) {
        // const sjcl_parameters = { mode: "gcm", ts: 128, adata: "blindturtle-auth", iter: 15000 };
        // return sjcl.encrypt(password, text, sjcl_parameters);
        let input_buffer = _.string_to_buffer(plaintext);
        return await encrypt_aes_gcm(password, input_buffer)
            .then(output_buffer => StringView.bytesToBase64(new Uint8Array(output_buffer)));
    };

    const decrypt_base64_to_string = async function(password, base64_data) {
        // return sjcl.decrypt(password, cipher);
        let input_buffer = StringView.base64ToBytes(base64_data);
        return await decrypt_aes_gcm(password, input_buffer.buffer)
            .then(output_buffer => _.buffer_to_string(output_buffer));
    };

    const create_encrypt_info = async function(password, iv, salt) {
        if (!_.is_instantiated(iv)) {
            iv = crypto.getRandomValues(new Uint8Array(12));
        }
        if (!_.is_instantiated(salt)) {
            salt = crypto.getRandomValues(new Uint8Array(16));
        }
        const aes_param = { 
            name: "AES-GCM", 
            iv: iv,
            additionalData: _.string_to_buffer("blindturtle-auth"), 
            tagLength: 128,     // tag length in bits
            length: 256         // key length in bits
        };
        password = _.string_to_buffer(password);
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

    return {
         encrypt: encrypt_string_to_base64
        ,decrypt: decrypt_base64_to_string
        ,hash: hash_string_sha256
    };

})(Utility);