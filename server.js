const https = require("https");
const fs = require("fs");
const next = require("next");

const dev = true;
const hostname = "0.0.0.0";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
    key: fs.readFileSync("./skna-uat.key"), // Ensure these files exist!
    cert: fs.readFileSync("./skna-uat.crt"),
};

app.prepare().then(() => {
    https.createServer(httpsOptions, (req, res) => {
        handle(req, res);
    }).listen(port, () => {
        console.log(`? HTTPS running at https://10.64.90.34:${port}`);
    });
});
