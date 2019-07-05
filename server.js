
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

const handleRequest = function(request, response) {
    let fileName = __dirname + request.url;
    let fileExtension = fileName.substring(fileName.lastIndexOf(".")+1).toLowerCase();
    let allowed = allowed_file_types.hasOwnProperty(fileExtension);

    if (allowed && fs.existsSync(fileName)) {
        console.log("REQUEST: 200 " + request.url);
        fs.readFile(fileName, function(error, data){
            let headers = { "Cache-Control": "no-cache" };
            headers["Content-Type"] = allowed_file_types[fileExtension].content_type + "; " + content_encoding;    
            response.writeHead(200, headers);
            response.end(data);
        });
    } else {
        console.log("REQUEST: 404 " + request.url);
        response.writeHead(404);
        response.end();
    }
};

const server = http.createServer(handleRequest);

server.listen(PORT, function(){
    console.log("Server Listening at http://localhost:" + PORT);
});