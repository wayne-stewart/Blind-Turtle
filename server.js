
/*
    NOT FOR PRODUCTION!

    This is a simple  nodejs server for local testing
*/

const http = require("http");
const fs = require("fs");

const PORT = 8080;

const allowed_file_types = {
    "html": { content_type: "text/html" },
    "js": { content_type: "application/javascript" },
    "css": { content_type: "text/css" }
};

const content_encoding = "charset=UTF-8";

const regx_double_periods = /\.\./;
const regx_path_valid_chars = /^[a-zA-Z0-9-_/.]+$/;

const validate_path_chars = function(path) {
    // I don't want to accept paths with .. because I don't
    // want to accidentally support relative paths
    if (!regx_double_periods.test(path)) {
        // I only want to accept a limited set of charcters to
        // minimize attack vectors
        if (regx_path_valid_chars.test(path)) {
            return true;
        }
    }
    return false;
};

const validate_local_path = function (path, request) {
    const file_extension = path.substring(path.lastIndexOf(".")+1).toLowerCase();
    if (file_extension && file_extension.length > 0) {
        if (allowed_file_types.hasOwnProperty(file_extension)) {
            const local_path = __dirname + path;
            if (fs.existsSync(local_path)) {
                request.local_path = local_path;
                request.file_extension = file_extension;
                return true;
            }
        }
    }
    return false;
};

const wrap_request = function(request) {
    let url = request.url;
    // argument checks and default
    if (typeof url !== "string" || 
        url.length === 0 || 
        url === "/" || 
        !url.startsWith("/")) {
        url = "/default.html";
    }
    const state = { wrapped_request: request, url: url };

    // split path from query string
    const i = url.indexOf("?");
    if (i > 0) {
        state.path = url.substr(0, i);
        state.query_string = url.substr(i+1);
    } else {
        state.path = url;
    }
    
    return state;
};

const handle_static_file = function(request, response) {
    fs.readFile(request.local_path, function(error, data) {
        if (error) {
            handle_error(request, response, 500, "error reading file.");
        } else {
            let headers = { "Cache-Control": "no-cache" };
            headers["Content-Type"] = allowed_file_types[request.file_extension].content_type + "; " + content_encoding;    
            response.writeHead(200, headers);
            response.end(data);
            console.log("200 " + request.url);
        }
    });
};

const handle_error = function(request, response, status, error) {
    let headers = { "Cache-Control": "no-cache", "Content-Type": "text/plain; charset=utf-8" };
    response.writeHead(status, headers);
    if (error) {
        response.write(error);
    }
    response.end();
    console.log(status + " " + request.url);
};

const handle_request = function(request, response) {
    request = wrap_request(request);

    // if the path has invalid chars, refuse to process any further
    if (validate_path_chars(request.path)) {
        if (validate_local_path(request.path, request)) {
            handle_static_file(request, response);
        } else {
            // maybe we allow some kind of api call in the future
            handle_error(request, response, 404);
        }
    } else {
        handle_error(request, response, 400, "invalid request path.");
    }
};

const server = http.createServer(handle_request);

server.listen(PORT, function(){
    console.log("Server Listening at http://localhost:" + PORT);
});