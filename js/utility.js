const Utility = (function() {
    "use strict"

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

    const ready = function(proc) {
        if (is_function(proc))
        {
            if (document.readyState === "complete" || document.readyState === "loaded") {
                proc();
            } else {
                window.addEventListener("DOMContentLoaded", proc);
            }
        }
    };

    return {
         is_object          : is_object       
        ,is_function        : is_function     
        ,is_instantiated    : is_instantiated 
        ,is_elementnode     : is_elementnode  
        ,is_string          : is_string       
        ,is_string_valid    : is_string_valid 
        ,is_boolean         : is_boolean      
        ,is_array           : is_array        
        ,swap               : swap            
        ,each               : each            
        ,remove             : remove          
        ,skip               : skip            
        ,first              : first           
        ,last               : last            
        ,query              : query           
        ,query_all          : query_all       
        ,add_listener       : add_listener    
        ,remove_listener    : remove_listener 
        ,string_to_buffer   : string_to_buffer
        ,buffer_to_string   : buffer_to_string
        ,buffer_to_hex      : buffer_to_hex   
        ,hex_to_buffer      : hex_to_buffer   
        ,string_to_hex      : string_to_hex   
        ,try_focus          : try_focus       
        ,is_enter_key       : is_enter_key    
        ,is_esc_key         : is_esc_key      
        ,careful_call       : careful_call
        ,center             : center
        ,show               : show
        ,hide               : hide
        ,ready              : ready
    };
})();

