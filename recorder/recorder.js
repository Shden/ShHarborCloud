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

/**
 * Returns named value from the payload passed if the value is not expired, otherwise
 * returns null.
 * 
 * @param {Object} payload - AWS IoT device shadow payload.
 * @param {String} valueName - name of the heating value data point.
 * @param {Number} expirationAfter - expiration period in sec. 
 * 
 * @returns heating data value or null. 
 */
function actualHeatingDataOrNothing(payload, valueName, expirationAfter)
{
        return (payload.metadata.reported.heating[valueName].timestamp + expirationAfter > payload.timestamp)
                ? payload.state.reported.heating[valueName] : null;

}

function persistHeatingData(dbConnectionPool, dataPoint)
{
        // dataPoint.state.reported.heating["Sasha-TS"]
        // dataPoint.state.metadata.heating["Sasha-TS"].timestamp
        // dataPoint.timestamp
        const EXPIRATION_TIME = 300;    // 5 * 60 seconds

        // console.log(dataPoint.state.reported);
        // console.log(dataPoint.metadata.reported);
        // console.log(dataPoint.timestamp);
        
        // console.log(actualHeatingDataOrNothing(dataPoint, "Sasha-TS", EXPIRATION_TIME));
        // console.log(actualHeatingDataOrNothing(dataPoint, "Agata-TS", EXPIRATION_TIME));
        // console.log(actualHeatingDataOrNothing(dataPoint, "Bedroom-TS", EXPIRATION_TIME));
        // console.log(actualHeatingDataOrNothing(dataPoint, "Livingroom-TS", EXPIRATION_TIME));
        // console.log(actualHeatingDataOrNothing(dataPoint, "Kitchen-TS", EXPIRATION_TIME));
        // console.log(actualHeatingDataOrNothing(dataPoint, "BathroomFloor-TS", EXPIRATION_TIME));

        return new Promise((resolved, rejected) => {
                dbConnectionPool.getConnection().then(dbConnection => {
                        dbConnectionPool.query(
                                "INSERT INTO \
                                HARBOR_HEATING (time, sasha, agatha, bedroom, livingroom, kitchen, bathroom_floor) \
                                VALUES(?, ?, ?, ?, ?, ?, ?);", 
                                [
                                        new Date(),
                                        actualHeatingDataOrNothing(dataPoint, "Sasha-TS", EXPIRATION_TIME),
                                        actualHeatingDataOrNothing(dataPoint, "Agata-TS", EXPIRATION_TIME),
                                        actualHeatingDataOrNothing(dataPoint, "Bedroom-TS", EXPIRATION_TIME),
                                        actualHeatingDataOrNothing(dataPoint, "Livingroom-TS", EXPIRATION_TIME),
                                        actualHeatingDataOrNothing(dataPoint, "Kitchen-TS", EXPIRATION_TIME),
                                        actualHeatingDataOrNothing(dataPoint, "BathroomFloor-TS", EXPIRATION_TIME)
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