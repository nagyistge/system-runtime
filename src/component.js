/*
 * System Runtime
 * Design | Create | Compose
 * https://system-runtime.github.io
 * @ecarriou
 * 
 * Copyright 2016 Erwan Carriou
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * This module manages the components. 
 * It is the factory of all the components that are created by Runtime.
 * 
 * @module runtime
 * @submodule runtime-component
 * @requires runtime-workflow
 * @requires runtime-db
 * @requires runtime-metamodel
 * @requires runtime-behavior
 * @requires runtime-helper
 * @requires runtime-log
 * @class runtime-component
 * @static 
 */

'use strict';

var $workflow = require('./workflow.js');
var $db = require('./db.js');
var $metamodel = require('./metamodel.js');
var $behavior = require('./behavior.js');
var $helper = require('./helper.js');
var $log = require('./log.js');
var $worklow = require('./workflow.js');
var $state = require('./state.js');


/* Private properties */


var PROPERTY_TYPE = 'property',
    LINK_TYPE = 'link',
    COLLECTION_TYPE = 'collection',
    METHOD_TYPE = 'method',
    EVENT_TYPE = 'event',
    NAME = '_name',
    store = {};


/* Private methods */


/*
 * Sub class to override push and pop method of Array Class.
 * @class RuntimeArray
 * @param {Object} conf
 * {String} classId name of the class
 * {String} type type of the array
 * {Array} arr array
 * @private
 */
function RuntimeArray(conf) {
    var arr = [],
        arrDb = [],
        type = '',
        id = '',
        propertyName = '',
        isReadOnly = false;

    conf = conf || {};
    type = conf.type || '';
    id = conf.id || '';
    propertyName = conf.propertyName || '';
    arrDb = conf.arr || [];

    if (typeof conf.readOnly !== 'undefined') {
        isReadOnly = conf.readOnly;
    }

    // init
    arrDb.forEach(function (val) {
        if (type.indexOf('@') !== -1) {
            arr.push($helper.getRuntime().require(val));
        } else {
            arr.push(val);
        }
    });

    /* Override push method.
     * @push
     * @param {RuntimeComponent|Object} value
     */
    arr.push = function push(val) {
        var isClass = false;

        if (!isReadOnly) {

            isClass = type.indexOf('@') !== -1;

            if (isClass) {
                if (val && $metamodel.inheritFrom(val.constructor.name, type.replace('@', ''))) {
                    arrDb.push(val.id());

                    $workflow.state({
                        "component": id,
                        "state": propertyName,
                        "data": [arrDb.length, val.id(), 'add']
                    });
                } else {
                    $log.invalidPropertyName(id, propertyName, val.id(), type);
                }
            } else {
                if (val && $metamodel.isValidType(val, type)) {
                    arrDb.push(val);

                    $workflow.state({
                        "component": id,
                        "state": propertyName,
                        "data": [arrDb.length, val, 'add']
                    });
                } else {
                    $log.invalidPropertyName(id, propertyName, val, type);
                }
            }
        } else {
            $log.readOnlyProperty(id, propertyName);
        }
        return arrDb.length;
    };

    /* Override pop method.
     * @pop
     * @return {RuntimeComponent|Object} value
     */
    arr.pop = function pop() {
        var result,
            val = null,
            isClass = false;

        if (!isReadOnly) {
            if (arrDb.length !== 0) {
                val = arrDb.pop();

                $workflow.state({
                    "component": id,
                    "state": propertyName,
                    "data": [arrDb.length, val, 'remove']
                });

                isClass = type.indexOf('@') !== -1;

                if (isClass) {
                    result = store[val];
                } else {
                    result = val;
                }
            }
        } else {
            $log.readOnlyProperty(id, propertyName);
        }
        return result;
    };

    /* Override sort method.
     * @sort
     * @param {Function} funct the sort function
     * @return {RuntimeArray} the current RuntimeArray
     */
    arr.sort = function sort(funct) {
        arrDb.sort(funct);
        return arr;
    };

    /* Override reverse method.
     * @reverse
     * @return {RuntimeArray} the reversed RuntimeArray
     */
    arr.reverse = function reverse() {
        arrDb.reverse();
        return arr;
    };

    return arr;
}

/* jshint -W058 */
RuntimeArray.prototype = new Array;
/* jshint +W058 */


/*
 * Get all the names of method parameters.
 * @method getParamNames
 * @param {String} id id of the class
 * @param {String} methodName name of the method
 * @return {Array} all the names of method parameters of the class
 * @private
 */
function getParamNames(id, methodName) {
    var params = [],
        result = [],
        length = 0,
        i = 0;

    params = $metamodel.getModel(id)[methodName].params;
    if (params) {
        length = params.length;
        for (i = 0; i < length; i++) {
            result.push(params[i].name);
        }
    }
    return result;
}


/*
 * Get all the property of a class.
 * @method getProperties
 * @param {String} id id of the class
 * @return {Array} all the properties of the class
 * @private
 */
function getProperties(id) {
    var model = null,
        schema = null,
        propNames = [],
        length = 0,
        i = 0,
        result = [];

    model = $metamodel.getModel(id);
    schema = $metamodel.getSchema(model[NAME]);

    propNames = Object.keys(schema);

    length = propNames.length;
    for (i = 0; i < length; i++) {
        if (schema[propNames[i]] === LINK_TYPE || schema[propNames[i]] === PROPERTY_TYPE || schema[propNames[i]] === COLLECTION_TYPE) {
            result.push({
                "name": propNames[i],
                "type": model[propNames[i]].type,
                "readOnly": model[propNames[i]].readOnly
            });
        }
    }

    return result;
}


/*
 * Get all the method of a class.
 * @method getMethods
 * @param {String} id id of the class
 * @return {Array} all the methods of the class
 * @private
 */
function getMethods(id) {
    var model = null,
        schema = null,
        propNames = [],
        length = 0,
        i = 0,
        result = [];

    model = $metamodel.getModel(id);
    schema = $metamodel.getSchema(model[NAME]);

    propNames = Object.keys(schema);

    length = propNames.length;
    for (i = 0; i < length; i++) {
        if (schema[propNames[i]] === METHOD_TYPE) {
            result.push(propNames[i]);
        }
    }

    return result;
}


/*
 * Get the schema of a structure.
 * @method getStructureProperties
 * @param {String} name of the property
 * @param {String} name of the model
 * @return {Array} list of property schema of the structure type
 * @private
 */
function getStructureProperties(propertyName, model) {
    var modelDef = null,
        type = null,
        structure = null,
        result = [],
        propNames = [];

    modelDef = $metamodel.getModel(model);
    type = modelDef[propertyName].type;
    structure = $metamodel.getType(type);

    if (structure.schema) {
        propNames = Object.keys(structure.schema);
        propNames.forEach(function (name) {
            structure.schema[name].name = name;
            result.push(structure.schema[name]);
        });
    }

    return result;
}


/*
 * Get all the event of a class.
 * @method getEvents
 * @param {String} id id of the class
 * @return {Array} all the events of the class
 * @private
 */
function getEvents(id) {
    var model = null,
        schema = null,
        propNames = [],
        length = 0,
        i = 0,
        result = [];

    model = $metamodel.getModel(id);
    schema = $metamodel.getSchema(model[NAME]);

    propNames = Object.keys(schema);

    length = propNames.length;
    for (i = 0; i < length; i++) {
        if (schema[propNames[i]] === EVENT_TYPE) {
            result.push(propNames[i]);
        }
    }

    return result;
}

/*
 * Get the value of a structure.
 * @method getStructureValue
 * @param {String} model name of the model
 * @param {String} id name of the component
 * @param {String} path 
 * @return {Object} the value
 * @private
 */
function getStructureValue(model, id, path) {
    var result = null,
        doc = $db.store[model][id],
        subPath = path.split('.'),
        length = subPath.length,
        i = 0;

    result = doc;

    for (i = 0; i < length; i++) {
        result = result[subPath[i]];
    }
    return result;
}


/*
 * Set the value of a structure.
 * @method getStructureValue
 * @param {String} model name of the model
 * @param {String} id name of the component
 * @param {String} path 
 * @param {String} value the value to set 
 * @private
 */
function setStructureValue(model, id, path, value) {
    var result = null,
        doc = $db.store[model][id],
        subPath = path.split('.'),
        length = subPath.length,
        i = 0;

    result = doc;

    for (i = 0; i < length - 1; i++) {
        result = result[subPath[i]];
    }
    result[subPath[i]] = value;
}


/*
 * Create a new class from a class definition.
 * @method createClasss
 * @param {String} classId name of the class
 * @return {Function} the class
 * @private
 */
function createClass(classId) {
    var body = function (config) {
        config = config || {};
        var body = {};

        if (config.constructor.name !== 'Object') {
            $log.invalidConctructorParameters(config, classId);
            config = {};
        }

        if (!$metamodel.isValidObject(config, $metamodel.getModel(classId), true, true)) {
            $log.invalidParameters(classId);
        }

        $metamodel.prepareObject(config, $metamodel.getModel(classId));

        if (typeof config._id === 'undefined') {
            config._id = $helper.generateId();
        }

        store[config._id] = this;

        // id
        body = function () {
            return config._id;
        };
        /* jshint -W054 */
        this.id = new Function("body", "return function id () { return body.call(this) };")(body);
        /* jshint +W054 */

        // classInfo
        if ($metamodel.inheritFrom(classId, 'RuntimeComponent')) {
            config.classInfo = classId + 'Info';
        }

        // create link to db
        $db.store[classId][config._id] = config;

        if ($helper.isRuntime() && $helper.getRuntime().require('db')) {
            $helper.getRuntime().require('db').insert(classId, config);
        }

        Object.freeze(this);

        if (this.init) {
            this.init(config);
        }
    };
    /* jshint -W054 */
    return new Function("body", "return function " + classId + " (config) { body.call(this,config) };")(body);
    /* jshint +W054 */
}


/*
 * Add an id method to a class that will return its id.
 * @method addId
 * @param {Function} Class a class
 * @param {String} classId name of the class
 * @private
 */
function addId(Class, classId) {
    var body = function () {
        return classId;
    };
    /* jshint -W054 */
    Class.id = new Function("body", "return function id (prop, val) { return body.call(this, prop, val) };")(body);
    /* jshint +W054 */
}


/*
 * Add properties to a component. All these properties will be accessed by a method with the same name.
 * Some checks can be done in order to see if the set of properties is compliant with the model.
 * @example
 * laure.age(); // get the age of a person
 * laure.age(22); // set the age of a person
 * @method addProperties
 * @param {String} model model name
 * @param {Function} Class Class
 * @param {String} classId name of the class
 * @private
 */
function addProperties(model, Class, classId) {
    var properties = getProperties(model);

    properties.forEach(function property(prop) {
        var body = {},
            propertyName = '',
            propertyType = '',
            propertyReadOnly = '';

        propertyName = prop.name;
        propertyType = prop.type;
        propertyReadOnly = prop.readOnly;

        if (Array.isArray(propertyType)) { // in case of array, return a sub array
            body = function body(position, value) {
                var search = [],
                    component = null,
                    runtimeArr = null,
                    val = null,
                    realVal = null;

                if (typeof value === 'undefined') {
                    if (typeof position === 'undefined') {

                        runtimeArr = new RuntimeArray({
                            "id": this.id(),
                            "propertyName": propertyName,
                            "readOnly": propertyReadOnly,
                            "classId": classId,
                            "type": propertyType[0],
                            "arr": $db.store[classId][this.id()][propertyName]
                        });

                        return runtimeArr;
                    } else {
                        val = $db.store[classId][this.id()][propertyName][position];
                        if (val) {
                            if (propertyType[0].indexOf('@') !== -1) {
                                realVal = $helper.getRuntime().require(val);
                            } else {
                                realVal = val;
                            }
                            return realVal;
                        }
                    }
                } else {
                    if (propertyReadOnly) {
                        $log.readOnlyProperty(this.id(), propertyName);
                    } else {
                        if (
                            $metamodel.isValidType(value, propertyType[0]) ||
                            ($metamodel.inheritFrom(value.constructor.name, propertyType[0].replace('@', '')) && (propertyType[0].indexOf('@') !== -1))
                        ) {
                            search = $db[classId].find({
                                "_id": this.id()
                            });
                            if (search.length) {

                                if (propertyType[0].indexOf('@') !== -1) {
                                    realVal = value.id();
                                } else {
                                    realVal = value;
                                }

                                component = search[0];
                                component[propertyName][position] = realVal;

                                if ($helper.isRuntime()) {
                                    $helper.getRuntime().require('db').update(classId, this.id(), propertyName, realVal);
                                }

                                $workflow.state({
                                    "component": this.id(),
                                    "state": propertyName,
                                    "data": [position, realVal, 'add']
                                });
                            } else {
                                $log.invalidPropertyName(this.id(), propertyName, value, propertyType);
                            }
                        }
                    }
                }
            };
            /* jshint -W054 */
            Class.prototype[propertyName] = new Function("body", "return function " + propertyName + " (position,value) { return body.call(this, position, value) };")(body);
            /* jshint +W054 */
        } else {
            body = function body(value) {
                var search = [],
                    component = null,
                    propertyValue = null;

                if (typeof value === 'undefined') {
                    component = $db.store[classId][this.id()];
                    if (component) {
                        switch (true) {
                            case propertyType.indexOf('@') !== -1:
                                propertyValue = get(component[propertyName]);
                                break;
                            case propertyType === 'date':
                                propertyValue = new Date(component[propertyName]);
                                break;
                            case $metamodel.isStructure(propertyName, classId):
                                propertyValue = addStructure('', propertyName, model, this.id());
                                break;
                            default:
                                propertyValue = component[propertyName];
                                break;
                        }
                        return propertyValue;
                    } else {
                        $log.destroyedComponentCall(propertyName, this.id());
                    }
                } else {
                    if (propertyReadOnly) {
                        $log.readOnlyProperty(this.id(), propertyName);
                    } else {
                        if ($metamodel.isValidType(value, propertyType)) {
                            search = $db[classId].find({ "_id": this.id() });
                            if (search.length) {
                                component = search[0];

                                switch (true) {
                                    case propertyType.indexOf('@') !== -1:
                                        component[propertyName] = value.id();
                                        break;
                                    case propertyType === 'date':
                                        component[propertyName] = value.toISOString();
                                        break;
                                    default:
                                        component[propertyName] = value;
                                        break;
                                }

                                if ($helper.isRuntime() && $helper.getRuntime().require('db')) {
                                    $helper.getRuntime().require('db').update(classId, this.id(), propertyName, value);
                                }

                                // case of RuntimeBehavior
                                if (classId === 'RuntimeBehavior') {
                                    $behavior.removeFromMemory(this.id());
                                }

                                $workflow.state({
                                    "component": this.id(),
                                    "state": propertyName,
                                    "data": [value]
                                });
                            }
                        } else {
                            $log.invalidPropertyName(this.id(), propertyName, value, propertyType);
                        }
                    }
                }
            };
            /* jshint -W054 */
            Class.prototype[propertyName] = new Function("body", "return function " + propertyName + " (value) { return body.call(this,value) };")(body);
            /* jshint +W054 */
        }
    });
}


/*
 * Add structure properties to a component. All these properties will be accessed by a method with the same name.
 * Some checks can be done in order to see if the set of properties is compliant with the model.
 * @method addStructure
 * @param {String} path parent path
 * @param {String} name property name
 * @param {String} model model name
 * @param {String} id id of the component
 * @return {Object} object that cointains methods to access the structure 
 * @private
 */
function addStructure(path, name, model, id) {
    var properties = getStructureProperties(name, model),
        sructure = {};

    properties.forEach(function property(prop) {
        var body = {},
            propertyName = '',
            propertyType = '',
            propertyReadOnly = '';

        propertyName = prop.name;
        propertyType = prop.type;
        propertyReadOnly = prop.readOnly;

        body = function body(value) {
            var search = [],
                component = null,
                propertyValue = null,
                parentPath = '',
                fullPath = '';

            if (path) {
                parentPath = parentPath + '.' + name;
            } else {
                parentPath = name;
            }
            fullPath = parentPath + '.' + propertyName;

            if (typeof value === 'undefined') {
                component = $db.store[model][id];
                if (component) {
                    switch (true) {
                        case propertyType.indexOf('@') !== -1:
                            propertyValue = get(getStructureValue(model, id, fullPath));
                            break;
                        case propertyType === 'date':
                            propertyValue = new Date(getStructureValue(model, id, fullPath));
                            break;
                        case $metamodel.isStructure(propertyName, model):
                            propertyValue = addStructure(parentPath, propertyName, model, id);
                            break;
                        default:
                            propertyValue = getStructureValue(model, id, fullPath);
                            break;
                    }
                    return propertyValue;
                } else {
                    $log.destroyedComponentCall(fullPath, id);
                }
            } else {
                if (propertyReadOnly) {
                    $log.readOnlyProperty(id, fullPath);
                } else {
                    if ($metamodel.isValidType(value, propertyType)) {
                        search = $db[model].find({ "_id": id });
                        if (search.length) {
                            component = search[0];

                            switch (true) {
                                case propertyType.indexOf('@') !== -1:
                                    setStructureValue(model, id, fullPath, value.id());
                                    break;
                                case propertyType === 'date':
                                    setStructureValue(model, id, fullPath, value.toISOString());
                                    break;
                                default:
                                    setStructureValue(model, id, fullPath, value);
                                    break;
                            }

                            if ($helper.isRuntime() && $helper.getRuntime().require('db')) {
                                $helper.getRuntime().require('db').update(model, id, fullPath, value);
                            }

                            // case of RuntimeBehavior
                            if (model === 'RuntimeBehavior') {
                                $behavior.removeFromMemory(id);
                            }

                            $workflow.state({
                                "component": id,
                                "state": fullPath,
                                "data": [value]
                            });
                        }
                    } else {
                        $log.invalidPropertyName(id, fullPath, value, propertyType);
                    }
                }
            }
        };

        /* jshint -W054 */
        sructure[propertyName] = new Function("body", "return function " + propertyName + " (value) { return body.call(this,value) };")(body);
        /* jshint +W054 */
    });

    return sructure;
}

/*
 * Add methods to a component.
 * The call to these methods will invoke the workflow in order to check that inpouts / outputs are compliant with the model.
 * @method addMethods
 * @param {String} model model name
 * @param {Function} Class Class
 * @param {String} classId name of the class
 * @private
 */
function addMethods(model, Class, classId) {
    var methods = getMethods(model);

    methods.forEach(function method(methodName) {
        var paramsName = getParamNames(classId, methodName),
            params = paramsName.join(','),
            body = function () {
                var result = null;

                result = $workflow.state({
                    "component": this.id(),
                    "state": methodName,
                    "data": arguments
                });

                return result;
            };
        if (params) {
            /* jshint -W054 */
            Class.prototype[methodName] = new Function("body", "return function " + methodName + " (" + params + ") { return body.call(this," + params + ") };")(body);
            /* jshint +W054 */
        } else {
            /* jshint -W054 */
            Class.prototype[methodName] = new Function("body", "return function " + methodName + " () { return body.call(this) };")(body);
            /* jshint +W054 */
        }
    });
}


/*
 * Add events to a component.
 * The call to these methods will invoke the workflow in order to check that inpouts are compliant with the model.
 * @method addEvents
 * @param {String} model model name
 * @param {Function} Class Class
 * @param {String} classId name of the class
 * @private
 */
function addEvents(model, Class, classId) {
    var events = getEvents(model);
    events.forEach(function event(methodName) {
        var paramsName = getParamNames(classId, methodName),
            params = paramsName.join(','),
            body = function () {
                var systems = [],
                    systemId = -1,
                    data = [],
                    i = 0,
                    length = -1,
                    message = {};

                if (classId === 'RuntimeChannel') {
                    systems = $db.RuntimeSystem.find({
                        'master': true
                    });
                    if (systems.length) {
                        systemId = systems[0]._id;

                        message.from = systemId;
                        length = arguments.length;
                        for (i = 0; i < length; i++) {
                            data.push(arguments[i]);
                        }
                        message.data = data;
                        message.event = methodName;

                        $db.RuntimeMessage.insert(message);

                        $workflow.state({
                            "component": this.id(),
                            "state": "send",
                            "data": [{
                                "event": message.event,
                                "from": message.from,
                                "data": message.data
                            }]
                        });
                    }
                } else {
                    $workflow.state({
                        "component": this.id(),
                        "state": methodName,
                        "data": arguments
                    });
                }
            };
        if (params) {
            /* jshint -W054 */
            Class.prototype[methodName] = new Function("body", "return function " + methodName + " (" + params + ") { return body.call(this," + params + ") };")(body);
            /* jshint +W054 */
        } else {
            /* jshint -W054 */
            Class.prototype[methodName] = new Function("body", "return function " + methodName + " () { return body.call(this) };")(body);
            /* jshint +W054 */
        }
    });
}


/*
 * Add a on method to a component to add behaviors to the component.
 * @method addOn
 * @param {Function} Class Class
 * @param {String} classId name of the class
 * @private
 */
function addOn(Class, classId) {
    var body = function (state, handler, useCoreAPI, isCore) {
        var behaviorId = '',
            currentState = '';

        if ($workflow.checkParams({
            "component": this,
            "methodName": "on",
            "args": arguments
        })) {
            if ($metamodel.isValidState(state, classId)) {
                if (
                    !$metamodel.isEvent(state, classId) &&
                    !$metamodel.isProperty(state, classId) &&
                    !$metamodel.isLink(state, classId) &&
                    !$metamodel.isCollection(state, classId) &&
                    $db.RuntimeBehavior.find({
                        "component": this.id(),
                        "state": state
                    }).length >= 1) {
                    $log.behaviorNotUnique(classId, state);
                } else {
                    if ($worklow.validParamNumbers(classId, state, handler)) {
                        behaviorId = $behavior.add(this.id(), state, handler, useCoreAPI, isCore);

                        currentState = $state.get(this.id());
                        if (currentState && state === currentState.name) {
                            $workflow.action(behaviorId, currentState.parameters.data);
                        }

                    } else {
                        $log.invalidParamNumberMethodOn(this.id(), state);
                    }
                }
            } else {
                $log.invalidStateOn(classId, state);
            }
        }
        return behaviorId;
    };
    /* jshint -W054 */
    Class.prototype.on = new Function("body", "return function on (state,handler,useCoreAPI,isCore) { return body.call(this,state,handler,useCoreAPI,isCore) };")(body);
    /* jshint +W054 */
}


/*
 * Add a on method to a class component to add behaviors to the class.
 * @method addOnClass
 * @param {Function} Class Class
 * @param {String} classId name of the class
 * @private
 */
function addOnClass(Class, classId) {
    var body = function (state, handler, useCoreAPI, isCore) {
        var behaviorId = '',
            currentState = '';

        if ($workflow.checkParams({
            "component": this,
            "methodName": "on",
            "args": arguments
        })) {
            if ($metamodel.isValidState(state, classId)) {
                if (
                    !$metamodel.isEvent(state, classId) &&
                    !$metamodel.isProperty(state, classId) &&
                    !$metamodel.isLink(state, classId) &&
                    !$metamodel.isCollection(state, classId) &&
                    $db.RuntimeBehavior.find({
                        "component": this.id(),
                        "state": state
                    }).length >= 1) {
                    $log.behaviorNotUnique(classId, state);
                } else {
                    if ($worklow.validParamNumbers(classId, state, handler)) {
                        behaviorId = $behavior.add(this.id(), state, handler, useCoreAPI, isCore);

                        currentState = $state.get(this.id());
                        if (currentState && state === currentState.name) {
                            $workflow.action(behaviorId, currentState.parameters.data);
                        }

                    } else {
                        $log.invalidParamNumberMethodOn(this.id(), state);
                    }
                }
            } else {
                $log.invalidStateOn(classId, state);
            }
        }
        return behaviorId;
    };
    /* jshint -W054 */
    Class.on = new Function("body", "return function on (state,handler,useCoreAPI,isCore) { return body.call(this, state, handler, useCoreAPI,isCore) };")(body);
    /* jshint -W054 */
}


/*
 * Add a off method to a class component to remove behaviors from the class.
 * @method addOffClass
 * @param {Object} Class Class
 * @param {String} classId name of the class
 * @private
 */
function addOffClass(Class, classId) {
    var body = function (state, behaviorId) {
        if ($workflow.checkParams({
            "component": this,
            "methodName": "off",
            "args": arguments
        })) {
            if ($metamodel.isValidState(state, classId)) {
                $behavior.remove({
                    "behaviorId": behaviorId,
                    "componentId": classId,
                    "state": state
                });
            } else {
                $log.InvalidStateOff(classId, state);
            }
        }
    };
    /* jshint -W054 */
    Class.off = new Function("body", "return function off (state, behaviorId) { return body.call(this, state, behaviorId) };")(body);
    /* jshint +W054 */
}


/*
 * Add a destroy method to a class component to detroy the class and all the components of the same class.
 * @method addDestroyClass
 * @param {Object} Class Class
 * @private
 */
function addDestroyClass(Class) {
    var body = function () {
        var id = this.id(),
            result = [],
            i = 0,
            length = 0;

        // if not virtual component
        if ($db[id]) {
            result = $db[id].remove();
        }

        delete store[id];

        // remove behaviors
        $behavior.remove({
            'componentId': id
        });

        length = result.length;
        for (i = 0; i < length; i++) {
            // remove behaviors
            $behavior.remove({
                'componentId': result[i]
            });
        }

        $workflow.state({
            "component": id,
            "state": "destroy"
        });
    };
    /* jshint -W054 */
    Class.destroy = new Function("body", "return function destroy () { return body.call(this) };")(body);
    /* jshint +W054 */
}


/*
 * Add the addClassInfo method on a class.
 * @method addClassInfoClass
 * @param {Object} Class Class
 * @private
 */
function addClassInfoClass(Class) {
    var body = function () {
        return get(this.id() + 'Info');
    };
    /* jshint -W054 */
    Class.classInfo = new Function("body", "return function classInfo () { return body.call(this) };")(body);
    /* jshint +W054 */
}


/*
 * Create a component from its configuration.
 * @method factory
 * @param {JSON} config configuration of the component
 * @return {Component} the created component
 * @private
 */
function factory(config) {
    config = config || {};

    var Class = {},
        classId = '';

    if (typeof config.model === 'undefined') {
        classId = $helper.generateId();
    } else {
        classId = config.model;
    }

    Class = createClass(classId);

    store[classId] = Class;

    addId(Class, classId);

    addProperties(config.model, Class, classId);
    addMethods(config.model, Class, classId);
    addEvents(config.model, Class, classId);

    // add default properties/methods only if the component
    // inherit from RuntimeComponent
    if ($metamodel.inheritFrom(classId, 'RuntimeComponent')) {
        addOn(Class, classId);
        addOnClass(Class, classId);
        addOffClass(Class, classId);
        addDestroyClass(Class);
        addClassInfoClass(Class);
    }

    Object.freeze(Class);

    return Class;
}


/* Public methods */


/*
 * Get a component by its id.
 * @method get
 * @param {String} id of the component
 * @return {Component} component
 */
function get(id) {
    return store[id];
}


/*
 * Create a component from its configuration.
 * @method create
 * @param {Object} config <br>
 * {String} model model name <br>
 * @return {Component}
 */
function create(config) {
    return factory(config);
}


/*
 * Destroy a component from its id.
 * @method destroy
 * @param {String} id id of the component to destroy
 */
function destroy(id) {
    var component = store[id],
        classId = '';

    if (component) {
        delete store[id];
        classId = component.constructor.name;
        $db[classId].remove({
            "_id": id
        });

        // remove behaviors
        $behavior.remove({
            'componentId': id
        });

        // case of Behavior
        if (classId === 'RuntimeBehavior') {
            $behavior.removeFromMemory(id);
        }
    }
}


/*
 * Remove a component with its id from the memory.
 * @method removeFromMemory
 * @param {String} id id of the component
 */
function removeFromMemory(id) {
    delete store[id];
}


/*
 * Remove all the components store in the memory.
 * @method clear
 */
function clear() {
    store = {};
}


/* exports */


/**
 * This module manages the components. 
 * It is the factory of all the components that are created by Runtime.
 * 
 * @module runtime
 * @submodule runtime-component
 * @requires runtime-workflow
 * @requires runtime-db
 * @requires runtime-metamodel
 * @requires runtime-behavior
 * @requires runtime-helper
 * @requires runtime-log
 * @class runtime-component
 * @static 
 */


/**
 * Create a component from its configuration.
 * @method create
 * @param {Object} config <br>
 * {String} model model name <br>
 * @return {Component} component
 */
exports.create = create;


/**
 * Get a component by its id.
 * @method get
 * @param {String} id id of the component
 * @return {Component} component
 */
exports.get = get;


/**
 * Remove a component with its id from the memory.
 * @method removeFromMemory
 * @param {String} id id of the component
 */
exports.removeFromMemory = removeFromMemory;


/**
 * Remove all the components store in memory.
 * @method clear
 */
exports.clear = clear;


/**
 * Destroy a component from its id.
 * @method destroy
 * @param {String} id id of the component to destroy
 * @return {Boolean} if the component has been destroyed
 */
exports.destroy = destroy;