var fs = require('fs');
var yaml = require('js-yaml');

if (!process.env.DB_ENV)
  throw ("env variable 'DB_ENV' is required")

let fileContents = fs.readFileSync('./src/config/environment.yaml', 'utf8');
let cfg = yaml.load(fileContents).db;
let dbCfg = cfg[process.env.DB_ENV];

if (process.env.DB_ENV == "test")
  process.env.DB_ENV = "dev";
else
  dbCfg = cfg[process.env.DB_ENV];

if (!fs.existsSync(".env")) {
  console.log("Creating .env File");
  let content =
    `DATABASE_URL="postgresql://${dbCfg.username}:${encodeURIComponent(dbCfg.password)}@${dbCfg.host}:${dbCfg.port}/${dbCfg.name}?schema=public"`

  fs.writeFileSync('.env', content, { flag: 'w+' }, err => { })
}