/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console */
/*mendix */

define('formatstring/widget/formatstring', ['dojo/_base/declare', 'mxui/widget/_WidgetBase', 'dijit/_TemplatedMixin',
'mxui/dom', 'dojo/dom', 'dojo/dom-class', 'dojo/_base/lang', 'dojo/text', 'dojo/json',
'dojo/_base/kernel', 'dojo/_base/xhr', 'dojo/text!formatstring/lib/timeLanguagePack.json', 'dojo/text!formatstring/widget/template/formatstring.html'
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, domClass, lang, text, json, dojo, xhr, languagePack, widgetTemplate) {
'use strict';

return declare('formatstring.widget.formatstring', [_WidgetBase, _TemplatedMixin], {
    templateString: widgetTemplate,
    
    _wgtNode: null,
    _contextGuid: null,
    _contextObj: null,
    _handles: [],
    _timeData: null,
    _releaseList: null,
    attributeList: null,
    localizedFormat: null,
    release: false,
    releaseOnUpdate: false,
    releaseAfterDisplay: false,
    subscrAssocObj: null,

    constructor: function () {
        this._timeData = json.parse(languagePack);
        this._releaseList = [];
        
        // set localized formatting (from dojoConfig)
        this.localizedFormat = {};			
        var locale = mx.ui.getLocale();
        
        if (dojo.config.localizedFormats) {
            dojo.config.localizedFormats.forEach(lang.hitch(this, function(format) {
                if (format.locale == locale) {
                    this.localizedFormat = format;
                }
            }));
        }
    },
    postCreate: function () {
        this._setupWidget();
        this._setupEvents();
        this.attributeList = this.notused;
    },
    update: function (obj, callback) {	
        if (obj) {
          this._contextObj = obj;
            this._resetSubscriptions();
            this._loadData();
            if(this.releaseOnUpdate === true){
                if(this.release === true) this._releaseDisplayObjects();
            }					
        }			  
        callback();
    },
    _releaseDisplayObjects: function (){
        if(this._releaseList.length > 0){
            mx.data.release(this._releaseList);
//			console.log(this.id+"released");
        }
    },
    _setupWidget: function () {
        this._wgtNode = this.domNode;
        domClass.add(this._wgtNode, 'formatstring_widget');
    },
    _setupEvents: function () {
        if (this.onclickmf) {
            this.connect(this._wgtNode, "onclick", this.execmf);
        }
    },
    _loadData: function () {
        this.replaceattributes = [];
        var referenceAttributeList = [],
            numberlist = [],
            i = null,
            value = null;
        for (i = 0; i < this.attributeList.length; i++) {
            if (this._contextObj.get(this.attributeList[i].attrs) !== null) {
                value = this._fetchAttr(this._contextObj, this.attributeList[i].attrs, this.attributeList[i].renderHTML, i,
                    this.attributeList[i].emptyReplacement, this.attributeList[i].decimalPrecision, this.attributeList[i].groupDigits);
                this.replaceattributes.push({
                    id: i,
                    variable: this.attributeList[i].variablename,
                    value: value
                });
            } else {
                //we'll jump through some hoops with this.
                referenceAttributeList.push(this.attributeList[i]);
                numberlist.push(i);
            }
        }

        if (referenceAttributeList.length > 0) {
            //if we have reference attributes, we need to fetch them. Asynchronicity FTW
            this._fetchReferences(referenceAttributeList, numberlist);
        } else {
            this._buildString();
        }
    },

    // The fetch reference is an async action, we use dojo.hitch to create a function that has values of the scope of the for each loop we are in at that moment.
    _fetchReferences: function (list, numberlist) {
        var i = null,
            callbackfunction = null,
            listLength = list.length;

        callbackfunction = function (data, obj) {
            var value = this._fetchAttr(obj, data.split[2], data.renderAsHTML, data.oldnumber, data.emptyReplacement, data.decimalPrecision, data.groupDigits);
            this.replaceattributes.push({
                id: data.i,
                variable: data.listObj.variablename,
                value: value
            });
            if(obj != null) this._releaseList.push(obj);
            if(this.releaseAfterDisplay === true && data.limit == true){
                if(this.release === true) this._releaseDisplayObjects();
            }
            this._buildString();
        };

        for (i = 0; i < listLength; i++) {
            var listObj = list[i],
                split = list[i].attrs.split('/'),
                guid = this._contextObj.getReference(split[0]),
                renderAsHTML = list[i].renderHTML,
                emptyReplacement = list[i].emptyReplacement,
                decimalPrecision = list[i].decimalPrecision,
                groupDigits = list[i].groupDigits,
                oldnumber = numberlist[i],
                dataparam = {
                    i: i,
                    listObj: listObj,
                    split: split,
                    renderAsHTML: renderAsHTML,
                    oldnumber: oldnumber,
                    limit: (listLength == i + 1)
                };


            if (guid !== '') {
                mx.data.get({
                    guid: guid,
                    callback: lang.hitch(this, callbackfunction, dataparam)
                });
            } else {
                //empty reference
                var emptyReplacement = (listObj.emptyReplacement !== null) ? listObj.emptyReplacement : '';
                this.replaceattributes.push({
                    id: i,
                    variable: listObj.variablename,
                    value: emptyReplacement
                });
                this._buildString();
            }
        }
    },

    _fetchAttr: function (obj, attr, renderAsHTML, i, emptyReplacement, decimalPrecision, groupDigits) {
        var returnvalue = "",
            options = {},
            numberOptions = null;
                    //[#188399] set emptyReplacement to an empty string if not set already
                    emptyReplacement = emptyReplacement || "";
        // Referenced object might be empty, can"t fetch an attr on empty
        if (!obj) {
            return emptyReplacement;
        }

        if (obj.isDate(attr)) {
            if (this.attributeList[i].datePattern !== '') {
                options.datePattern = this.attributeList[i].datePattern;
            } else if (this.localizedFormat) {
                options.datePattern = this.localizedFormat.date;
            }
            if (this.attributeList[i].timePattern !== '') {
                options.timePattern = this.attributeList[i].timePattern;
            } else if (this.localizedFormat) {
                options.timePattern = this.localizedFormat.time;
            }
            var datetimeformat;
            if (this.attributeList[i].datetimeformat !== '') {
                datetimeformat = this.attributeList[i].datetimeformat;
            } else if (this.localizedFormat) {
                datetimeformat = this.localizedFormat.datetime;
            }
            returnvalue = this._parseDate(datetimeformat, options, obj.get(attr));
        } else if (obj.isEnum(attr)) {
            returnvalue = this._checkString(obj.getEnumCaption(attr, obj.get(attr)), renderAsHTML);

        } else if (obj.isNumeric(attr) || obj.isCurrency(attr)) {
            numberOptions = {};
            numberOptions.places = decimalPrecision;
            if (groupDigits) {
                numberOptions.locale = dojo.locale;
                numberOptions.groups = true;
            }

            returnvalue = mx.parser.formatValue(obj.get(attr), obj.getAttributeType(attr), numberOptions);
        } else if (obj.isBoolean(attr)) {
            returnvalue = mx.parser.formatValue(obj.get(attr), "Boolean");			
        } else {
            if (obj.getAttributeType(attr) === "String") {
                returnvalue = this._checkString(mx.parser.formatAttribute(obj, attr), renderAsHTML);
            }
        }
        if (returnvalue === '') {
            return emptyReplacement;
        } else {
            return returnvalue;
        }
    },


    // _buildString also does _renderString because of callback from fetchReferences is async.
    _buildString: function (message) {
        var str = this.displaystr,
            settings = null,
            attr = null;

        for (attr in this.replaceattributes) {
            settings = this.replaceattributes[attr];
            str = str.split('${' + settings.variable + '}').join(settings.value);
        }

        this._renderString(str);
    },

    _renderString: function (msg) {
        var div = null;

        dojo.empty(this._wgtNode);
        div = dom.div({
            'class': 'formatstring'
        });
        div.innerHTML = msg;
        this._wgtNode.appendChild(div);

    },

    _checkString: function (string, renderAsHTML) {
        if (string.indexOf("<script") > -1 || !renderAsHTML) {
            string = dom.escapeHTML(string);
        }
        return string;
    },

    _parseDate: function (format, options, value) {
        var datevalue = value;

        if (value === "") {
            return value;
        }

        if (format === 'relative') {
            return this._parseTimeAgo(value);
        } else {
            options.selector = format;

            datevalue = dojo.date.locale.format(new Date(value), options);
        }
        return datevalue;
    },

    _parseTimeAgo: function (value, data) {
        var date = new Date(value),
            now = new Date(),
            appendStr = null,
            diff = Math.abs(now.getTime() - date.getTime()),
            seconds = Math.floor(diff / 1000),
            minutes = Math.floor(seconds / 60),
            hours = Math.floor(minutes / 60),
            days = Math.floor(hours / 24),
            weeks = Math.floor(days / 7),
            months = Math.floor(days / 31),
            years = Math.floor(months / 12),
            time = null;

        time = this._timeData[dojo.locale];
        appendStr = (date > now) ? time.timestampFuture : time.timestampPast;

        function createTimeAgoString(nr, unitSingular, unitPlural) {
            return nr + " " + (nr === 1 ? unitSingular : unitPlural) + " " + appendStr;
        }

        if (seconds < 60) {
            return createTimeAgoString(seconds, time.second, time.seconds);
        } else if (minutes < 60) {
            return createTimeAgoString(minutes, time.minute, time.minutes);
        } else if (hours < 24) {
            return createTimeAgoString(hours, time.hour, time.hours);
        } else if (days < 7) {
            return createTimeAgoString(days, time.day, time.days);
        } else if (weeks < 5) {
            return createTimeAgoString(weeks, time.week, time.weeks);
        } else if (months < 12) {
            return createTimeAgoString(months, time.month, time.months);
        } else if (years < 10) {
            return createTimeAgoString(years, time.year, time.years);
        } else {
            return "a long time " + appendStr;
        }

    },

    execmf: function () {
        if (!this._contextObj) {
            return;
        }

        if (this.onclickmf) {
            mx.data.action({
                params: {
                    actionname: this.onclickmf,
                    applyto: 'selection',
                    guids: [this._contextObj.getGuid()]
                },
                callback: function () {
                    // ok   
                },
                error: function () {
                    // error
                }

            });
        }
    },

    _resetSubscriptions: function () {
        // Release handle on previous object, if any.
        var i = 0;
        this._releaseDisplayObjects();

        for (i = 0; i < this._handles.length; i++) {
            if (this._handles[i]) {
                this.unsubscribe(this._handles[i]);
                this._handles[i] = null;
            }
        }

        if (this._contextObj) {
            this._handles[0] = this.subscribe({
                guid: this._contextObj.getGuid(),
                callback: this._loadData
            });

            for (i = 0; i < this.attributeList.length; i++) {
                this._handles[i + 1] = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.attributeList[i].attrs,
                    callback: this._loadData
                });

            }
            if(this.subscrAssocObj != null){
                var subGuid = this._contextObj.getReference(this.subscrAssocObj.split('/')[0]);
                if(subGuid != null && subGuid != ""){
                    this._handles[this._handles.length] = this.subscribe({
                        guid: subGuid,
                        callback: this._loadData
                    });
                }
            }
        }
    }
});
});
require(['formatstring/widget/formatstring']);
