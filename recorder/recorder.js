// Recorder fetches house data using ShWade API to persist live data to DB
const config = require('./config/recorder-config.json');
const DB = require('mariadb');
const aws = require('aws-sdk');

console.info(`Recording interval is set to each ${config.RecordingIntervalSec} seconds.`);

let DBConnectionPool = DB.createPool(config.DBConnection);

const iotData = new aws.IotData( 
        { 
                accessKeyId: config.shadow.accessKeyId,
                secretAccessKey: config.shadow.secretAccessKey,
                endpoint: config.shadow.endpoint,
                region: config.shadow.region
        } 
);


// API data persisting loop
setInterval(() => {
        console.info('Update started...');
        
        getIoTShadowData().then(dataPoint => {
                Promise.all([
                        persistHeatingData(DBConnectionPool, dataPoint)
                ])
                .then(() => {
                        console.info('updated.');
                })
                .catch(err => {
                        console.error(err);
                })
        })
}, config.RecordingIntervalSec * 1000);

// Get ShHarbor shadow data
function getIoTShadowData()
{
        return new Promise((resolved, rejected) => {
                iotData.getThingShadow({ thingName : config.shadow.thingName }, (err, data) => {
                        if (err)
                                rejected(err);
                        else 
                                resolved(JSON.parse(data.payload));
                });        
        });
}

function persistHeatingData(dbConnectionPool, dataPoint)
{
        return new Promise((resolved, rejected) => {
                dbConnectionPool.getConnection().then(dbConnection => {
                        dbConnectionPool.query(
                                "INSERT INTO \
                                HARBOR_HEATING (time, sasha, agatha, bedroom, livingroom, kitchen, bathroom_floor) \
                                VALUES(?, ?, ?, ?, ?, ?, ?);", 
                                [
                                        new Date(),
                                        dataPoint.state.reported.heating["Sasha-TS"],
                                        dataPoint.state.reported.heating["Agata-TS"],
                                        dataPoint.state.reported.heating["Bedroom-TS"],
                                        dataPoint.state.reported.heating["Livingroom-TS"],
                                        dataPoint.state.reported.heating["Kitchen-TS"],
                                        dataPoint.state.reported.heating["BathroomFloor-TS"]
                                ]
                        ).then(() => {
                                dbConnection.end();
                                resolved();              
                        }).catch(err => {
                                //handle error
                                console.log(err); 
                                dbConnection.end();
                                rejected(err);
                        });
                });
        });
}


if (typeof exports !== 'undefined')
{
        // check methods
        exports.persistHeatingData = persistHeatingData;

        // check properties for testing
        exports.DBConnectionPool = DBConnectionPool;
}