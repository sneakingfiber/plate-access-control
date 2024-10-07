const http = require('http');
const port = 3001;

const server = http.createServer((req,res) =>{
    res.writeHead(200,{'Content-Type':'text/plain'});
    const responseText = `
    port9=active
    port10=active
    port11=active
    port12=inactive
    port13=inactive
    port14=inactive
    port15=inactive
    port16=inactive`;

    res.end(responseText);

});

server.listen(port, () => {
    console.log(`Server avviato su http://localhost:${port}`);
});
