/**
 * Copyright 2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

// If you use this as a template, update the copyright with your own name.

// Ernesto Node-RED node file


module.exports = function(RED) {
    "use strict";
    // require any external libraries we may need....
    var fs = require('fs');
    var Q = require('q');

    // HID management (for SLT boards)
    var HID = require('node-hid');

    var mySLT = undefined;

    var commandcodes = {
        'led' : 0x80,
        'temp_light' : 0x81,
        'temp': 0x82,
        'ligth': 0x83,
        'bootloader' : 0x85,
        'humidity' : 0x86,
        'temp_light_humidity' : 0x87
    };

    var getSLTDevice = function() {
        var deferred = Q.defer();

        if (mySLT) {
            deferred.resolve(mySLT);
        } else {
            var devices = HID.devices();
            var devicePath = null
            for (var i in devices) {
                var device = devices[i];
                if (device.vendorId == "1240" && device.productId == "63" && !devicePath) {
                    devicePath = device.path;
                }
            }
            if (devicePath) {
                mySLT = new HID.HID(devicePath);
                mySLT.on('error', sltErrorHandler);
                deferred.resolve(mySLT); 
            } else {
                deferred.reject(new Error("No SLT board available"));
            }

        }

        return deferred.promise;
    }

    var sltErrorHandler = function() {
        console.log("ERROR HANDLER")

        if (mySLT !== undefined) {
            mySLT.removeListener('error', sltErrorHandler);
            mySLT.close();
            mySLT = undefined;
        }
        
    }

    var getDataLHT = function() {
        var deferred = Q.defer();

        getSLTDevice()
        .then(function(device) {
            var outdata = new Buffer(64);
            outdata[0] = commandcodes['temp_light'];
            try {
                device.write(outdata);
                device.read(function(err,data) {
                    var celsius = ((data[2] << 8) + data[1]);
                    celsius = (celsius * 0.0625);

                    var lux = (data[4] << 8) + data[3];
                    lux = lux*1.2;

                    deferred.resolve({"celsius":celsius, "lux":lux});
                })

            } 
            catch(err) {
                console.log("CATCH");
                deferred.reject(err);
            }

        })
        .catch(function(err) {
            deferred.reject(err);
        })
 
        return deferred.promise;

    }

    // The main node definition - most things happen in here
    function SLTNode(config) {
        // Create a RED node
        RED.nodes.createNode(this,config);

        var node = this;

        // respond to inputs....
        this.on('input', function (msg) {
            getDataLHT()
            .then(function(data) {
                msg.payload = data;
                node.send(msg);
            })
            .catch(function(err) {
                node.warn(err);
                sltErrorHandler();

            })
            
        });

        this.on("close", function() {
            //closeBoard();

        });
    }

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("slt",SLTNode);

}
