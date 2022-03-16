/* global Ext Rally */
Ext.define('Rally.technicalservices.TimeModelBuilder',{
    singleton: true,

    deploy_field: 'c_IsDeployed',
    
    appendKeyPrefix: 'rally.technicalservices.timesheet.append',
    amendKeyPrefix: 'rally.technicalservices.timesheet.amend',
    
    build: function(modelType, newModelName) {
        var deferred = Ext.create('Deft.Deferred');

        var oid_sort = function(v) {
            if ( Ext.isEmpty(v) ) {
                return -1;
            }
            return v.ObjectID;
        };
        
        var name_sort = function(v) {            
            if ( Ext.isEmpty(v) ) {
                return "";
            }
            return v._refObjectName;
        };
        
        Rally.data.ModelFactory.getModel({
            type: modelType,
            scope: this,
            success: function(model) {
                var base_fields = model.getFields();
                
                var wp = model.getField('WorkProduct');
                wp.sortType = oid_sort;
                var task = model.getField('Task');
                task.sortType = oid_sort;
                
                var related_fields = [
                    { name: '__FirstTimeEntryItem', type:'object' },    // To make it easier to pull common data
                    { name: '__AllTimeEntryItems', type:'object' },    // In case a non-Sunday week start requires multiple TimeEntryItems to store data
                    { name: '__WeekStartKey', type:'string' },     // In case a non-Sunday week, store the specific week start date string "Y-m-d" spanned by the 2 TimeEntryItems
                    { name: '__Feature',   type: 'object', sortType: oid_sort},
                    { name: '__Release',   type: 'object', sortType: name_sort },
                    { name: '__Iteration', type: 'object', sortType: name_sort},    // Added to allow sorting
                    { name: '__Product',   type: 'object', sortType: name_sort },
                    { name: '__Total',     type: 'float', defaultValue: 0 },
                    { name: '__SecretKey', type:'auto', defaultValue: 1 },  // Used to support `groupingsummary` feature in grid
                    { name: '__Appended', type: 'boolean', defaultValue: false },
                    { name: '__Amended', type: 'boolean', defaultValue: false },
                    { name: '__PrefID', type:'auto', defaultValue: -1 },
                    { name: '_ReleaseLockFieldName',  type:'string', defaultValue: Rally.technicalservices.TimeModelBuilder.deploy_field },
                    { name: '__Pinned', type: 'boolean' }
                ];
                
                var day_fields = this._getDayFields();
                
                var all_fields = Ext.Array.merge(base_fields, day_fields, related_fields);
                
                // TODO (tj) move functions into public / private
                var new_model = Ext.define(newModelName, {
                    extend: 'Ext.data.Model',
                    fields: all_fields,
                    addTimeEntryValue: this._addTimeEntryValue,
                    _updateTotal: this._updateTotal,
                    _days: TSDateUtils.getDaysOfWeek(),
                    save: this._save,
                    _saveAsPref: this._saveAsPref,
                    _savePreference: this._savePreference,
                    _saveChangesWithPromise: this._saveChangesWithPromise,
                    getField: this.getField,
                    clearAndRemove: this.clearAndRemove,
                    isLocked: this._isLocked,
                    isPinned: this._isPinned,
                    isDeleted: this._isDeleted,
                    _saveTEV: this._saveTEV,
                    _createTimeEntryValue: this._createTimeEntryValue,
                    _getTimeEntryForDayName: this._getTimeEntryForDayName,
                    initTimeEntryValues: this.initTimeEntryValues,
                    hasTimeEntryValues: this.hasTimeEntryValues,
                });
                
                this.model = new_model;
                
                deferred.resolve(new_model);
            }
        });
        return deferred;
    },
    
    getFetchFields: function() {
        return [ 'ObjectID', 'Name', 'Release', 'User', 'UserName', 'Iteration', 'PlanEstimate', 'ScheduleState', 'Estimate', 'State', this.deploy_field ];
    },
    
    _isPinned: function() {
        return this.get('__Pinned');
    },
    
    _isDeleted: function() {
        if ( Ext.isEmpty(this.get('WorkProduct') )) {
            return true;
        }
        
        return ( Ext.isEmpty(this.get('Task')) && !Ext.isEmpty(this.get('TaskDisplayString')));
        
    },
    
    _isLocked: function (fieldName, newValue) {
        var release = this.get('__Release');
        var lock_field_name = this.get('_ReleaseLockFieldName');
                
        if ( Ext.isEmpty(release) || Ext.isEmpty(lock_field_name) ) {
            return false;
        }
        
        return release[lock_field_name];
    },
    
    clearAndRemove: function() {
        var timeEntryItems = this.get('__AllTimeEntryItems');
        
        var cells_to_clear = _.map(TSDateUtils.getDaysOfWeek(), function(day) {
            return Rally.technicalservices.TimeModelBuilder._getDayFieldName(day)
        });
        cells_to_clear.push('__Total');
        var me = this;
                
        var key = Ext.String.format("{0}.{1}.{2}.{3}", 
            TSUtilities.deletionKeyPrefix,
            this.get('__WeekStartKey'),
            this.get('User').ObjectID,
            new Date().getTime()
        );
        
        // Clean up the time entry values, this will be enough to trigger a refresh of the grid which will cause
        // the row to be filtered out
        Ext.Array.each(TSDateUtils.getDaysOfWeek(), function(day) {
            var timeEntryValueFieldName = Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(day)
            var timeEntryValue = this.get(timeEntryValueFieldName);
            if ( timeEntryValue ) {
                timeEntryValue.destroy();
            }
            this.set(timeEntryValueFieldName, null);
        }, this);
        
        var data = this.getData();
        // Must delete the references to the time entry items before we can JSON encode the data.
        // This is used for an audit trail of the time entry changes
        delete data.__AllTimeEntryItems;
        delete data.__FirstTimeEntryItem;
        var value = Ext.JSON.encode(data);
                
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {

                var pref_config = {
                    Name: key,
                    Value: value,
                    Project: TSUtilities.getPreferenceProject()
                }

                var pref = Ext.create(model, pref_config);
                
                pref.save({
                    callback: function(deleted_pref, operation) {                        
                        if(operation.wasSuccessful()) {
                            Ext.Array.each(cells_to_clear, function(cell_to_clear){
                                me.set(cell_to_clear,0);
                            },me);
                            
                            if ( me.get('__PrefID') > 0 ) {
                                // destroy the preference
                                var oid = me.get('__PrefID');
                                
                                Rally.data.ModelFactory.getModel({
                                    type: 'Preference',
                                    success: function(model) {
                                        model.load(oid, {
                                            fetch: ['Name', 'ObjectID', 'Value'],
                                            callback: function(result, operation) {
                                                if(operation.wasSuccessful()) {
                                                    result.destroy();
                                                }
                                            }
                                        });
                                    }
                                });
                                
                            } else {
                                // TODO (tj) When can we safetly destroy a time entry item?
                                // Likley if we fetched its values array and checked if it had
                                // any values outside of the current week?
                                /*
                                _.each(timeEntryItems, function(item) {
                                    if ( ! Ext.isEmpty(item) && item.data.ObjectID > 0 ) {
                                        item.destroy();
                                    }
                                });
                                */
                            }
                            // Can't destroy the row because it has the existing time entry values which we will need to re-use
                            // if user re-adds the item
                            //me.destroy();
                        } else {
                            Ext.Msg.alert('Problem removing', operation.error.errors[0]);
                        }
                    }
                });
            }
        });
    },
    
    _saveAsPref: function() {
        var me = this;
        var item = this.get('Task') || this.get('WorkProduct');
        var prefix = Rally.technicalservices.TimeModelBuilder.appendKeyPrefix;
        if ( this.get('__Amended') ) {
            prefix = Rally.technicalservices.TimeModelBuilder.amendKeyPrefix;
        }
        var key = Ext.String.format("{0}.{1}.{2}.{3}", 
            prefix,
            this.get('__WeekStartKey'),
            this.get('User').ObjectID,
            item.ObjectID
        );
        
        var value = Ext.JSON.encode(this.getData());
        var project_oid = this.get('Project').ObjectID;
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {

                var pref_config = {
                    Name: key,
                    Value: value,
                    Project: TSUtilities.getPreferenceProject()
                }

                var pref = Ext.create(model, pref_config);
                
                pref.save({
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            me.set('ObjectID', result.get('ObjectID'));
                            me.set('__PrefID', result.get('ObjectID'));
                        } else {
                            Ext.Msg.alert('Problem amending', operation.error.errors[0]);
                        }
                    }
                });
            }
        });
    },
    
    _savePreference: function(changes) {
        var oid = this.get('__PrefID');
        var me = this;
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {
                model.load(oid, {
                    fetch: ['Name', 'ObjectID', 'Value'],
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            result.set('Value', Ext.JSON.encode(me.getData()));
                            result.save({
                                callback: function(result, operation) {
                                    if(operation.wasSuccessful()) {
                                        
                                    } else {
                                        Ext.Msg.alert('Problem saving change', operation.error.errors[0]);
                                    }
                                }
                            });
                        }
                    }
                });
            }
        });
        
    },
    
    _saveTEV: function(src) {
        var deferred = Ext.create('Deft.Deferred');

        src.save({
            callback: function() {
                deferred.resolve();
            }
        });
        return deferred.promise;
    },
    
    _createTimeEntryValue: function(dayName, value) {
        var deferred = Ext.create('Deft.Deferred')
        
        Rally.data.ModelFactory.getModel({
            type: 'TimeEntryValue',
            scope: this,
            success: function(tev_model) {
                var fields = tev_model.getFields();
                Ext.Array.each(fields, function(field,idx) {
                    if ( field.name == "TimeEntryItem" ) {
                        field.readOnly = false;
                        field.persist = true;
                        field.type = 'string';                        
                    }
                    if ( field.name == "DateVal" ) {
                        // override field definition so that we can write to the 
                        // field AND pass it a string for midnight at Z instead of
                        // the local timestamp
                        fields[idx] = Ext.create('Rally.data.wsapi.Field',{
                            type:'string',
                            readOnly: false,
                            persist: true,
                            name: 'DateVal',
                            custom: false,
                            hidden: false,
                            useNull: false
                            
                        });
                    }
                    
                });
                // Depending on the configured week start day, the edited day may
                // fall into 1 of 2 different TimeEntryItems that were created when
                // the item was added to the timesheet.
                var timeEntryItem = this._getTimeEntryForDayName(dayName);
                var teiWeekStartDate = timeEntryItem.get('WeekStartDate');    // Sunday-based, local date
                var dayOffset = TSDateUtils.getSundayBasedIndexForDay(dayName);
                var tevDate = Ext.Date.add(teiWeekStartDate, Ext.Date.DAY, dayOffset);
                var timeEntryValue = Ext.create(tev_model,{
                    Hours: value,
                    TimeEntryItem: { _ref: timeEntryItem.get('_ref') },
                    DateVal: TSDateUtils.getUtcIsoForLocalDate(tevDate,true)
                });

                var tevFieldName = Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(dayName);
                timeEntryValue.save({
                    scope: this,
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            this.set(tevFieldName, result);
                            this._updateTotal();
                            deferred.resolve();
                        } else {
                            this.set(tevFieldName, null);
                            console.error('Problem saving time entry value');
                            deferred.reject(operation.error && operation.error.errors.join('.'));
                        }
                    }
                });

            }
        });
        
        return deferred.promise;
    },
    
    /**
     * Set each day of the week for this TSTableRow to a zero hour time entry value.
     * When the week doesn't start on a Sunday, a TimeEntryItem with no TimeEntryValues
     * for the days of its week means it was created to hold data for the subsequent week,
     * and can be hidden until the user also decides to add it to the current week.
     */
    initTimeEntryValues: function() {
        // The create time entry value operations are asynchronous. Set a flag so we can
        // know the user wants to see this row even before the time entry value creations
        // have completed.
        var promises = _.map(TSDateUtils.daysOfWeek, function(dayName) {
            return this._createTimeEntryValue(dayName, 0);
        }, this);
        return Deft.promise.Promise.all(promises);
    },
    
    /**
     * Returns true if there are any time entry values for any of the time entry items associated with
     * this row's start date
     */
    hasTimeEntryValues: function() {
        return _.any(TSDateUtils.daysOfWeek, function(dayName) {
            var tevFieldName = Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(dayName);
            return this.get(tevFieldName);
        }, this);
        
    },
    
    _saveChangesWithPromise: function() {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        var changes = this.getChanges();

        me.modified = {}; // stop repeating the same change
        
        var promises = [];
        Ext.Object.each(changes, function(field_name, value) {
            var field = this.getField(field_name);
            var src_field_name = field.__src;
                        
            if ( ! Ext.isEmpty(src_field_name) ) {
                // this is a field that belongs to another record
                var src = this.get(src_field_name);
                
                if ( !Ext.isEmpty(src) ) {
                    // the other record exists
                    src.set('Hours', value);
                    // TODO: check for errors on return 
                    me._updateTotal();
                    
                    promises.push(function() { return me._saveTEV(src) });
                    
                } else {
                    var dayName = Rally.technicalservices.TimeModelBuilder._getDayNameFromDayField(field_name);
                    promises.push(function() {
                        return me._createTimeEntryValue(dayName, value);
                    });
                }
            }
        },this);
                
        if ( promises.length === 0 ) { 
            deferred.resolve(this); 
            return deferred;
        }
        
        this.process = Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(result) { 
                deferred.resolve(this);
            },
            failures: function(msg) {
                deferred.reject(msg);
            },
            progress: function(msg) {
                console.log('Progress');
            },
            cancel: function(msg) {
                console.log('Cancel');
            }
        });
        
        return deferred;
    },
    
    _save: function(v) { 
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
            

        if ( ( this.get('__Amended') || this.get('__Appended') ) && this.get('ObjectID') == -1 ) {
            this._saveAsPref();
        }
        
        if ( this.get('__Appended') || this.get('__Amended') ) {
            this._savePreference(changes);
            return;
        }
        
        // tabbing too quickly gets us in a hole
        if ( this.process && this.process.getState() == 'pending' ) {
            
            this.process.then({
                scope: this,
                success: function(results) {
                    deferred = this._saveChangesWithPromise();
                },
                failure: function(msg) {
                    deferred.reject(msg);
                }
            });
            
        } else {
            
            this._saveChangesWithPromise().then({
                scope: this,
                success: function(result) {
                    deferred.resolve(this); // Return a reference to the TSTableRow
                },
                failure: function(msg) {
                    deferred.reject(msg);
                }
            });
        }
        
        return deferred.promise;
        
    },
    
    getField: function(field_name) {
        var fields = this.fields.items;
        var field = null;
        
        Ext.Array.each(fields, function(f) {
            if ( f.name == field_name || f.displayName == field_name ) {
                field = f;
            }
        });
        return field;
    },
    
    _updateTotal: function() {
        var total = 0;
        Ext.Array.each(TSDateUtils.getDaysOfWeek(), function(day){
            var value = this.get(Ext.String.format('__{0}',day)) || 0;
            total += value;
        },this);
        this.set('__Total', total);
    },
    
    _addTimeEntryValue: function(timeEntryValue) {
        var utcDay = timeEntryValue.get('DateVal').getUTCDay();
        var dayName = TSDateUtils.getDayForSundayBasedIndex(utcDay);
        var hours = timeEntryValue.get('Hours');
        
        var day_number_field_name = Rally.technicalservices.TimeModelBuilder._getDayFieldName(dayName);
        var day_record_field_name = Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(dayName);
        
        this.set(day_number_field_name, hours);
        this.set(day_record_field_name, timeEntryValue);
        
        this._updateTotal();
        
        // don't try to write these back when we're first getting them out of the system
        this.dirty = false;
        this.modified = [];
    },
    
    _getDayFieldName: function(day_name) {
        return Ext.String.format('__{0}',day_name);
    },
    
    _getDayNameFromDayField: function(field_name) {
        return field_name.slice(2);
    },
    
    _getDayRecordFieldName: function(day_name) {
        return Ext.String.format('__{0}_record',day_name);
    },
    
    _getDayFields: function() {
        var daysOfWeek = TSDateUtils.getDaysOfWeek();
        var result = [];
        Ext.Array.each(daysOfWeek, function(day,idx) {
            // This field stores the hour value entered for a day
            result.push({
                name: Rally.technicalservices.TimeModelBuilder._getDayFieldName(day),
                type: 'auto',
                defaultValue: 0,
                __src: Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(day),
                __index: idx
            });
            // This field stores the TimeEntryValue created for any entered hours for a day
            result.push({
                name: Rally.technicalservices.TimeModelBuilder._getDayRecordFieldName(day),
                type: 'object',
                defaultValue: null
            });
        }, this);
        
        return result;
        
    },
    
    // CAUTION: Don't _.memoize() this function because it is used in a builder and won't use the
    // correct 'this' value in the memoization
    _getTimeEntryForDayName: function(dayName) {
        var daysOfWeek = TSDateUtils.getDaysOfWeek();
        var dayIndex = daysOfWeek.indexOf(dayName);
        var sundayIndex = daysOfWeek.indexOf('Sunday');
        var result;
        if ( sundayIndex === 0 ) {
            // Start of week is Sunday. We always use 1 time entry item
            result = this.get('__AllTimeEntryItems')[0]
        } else {
            // Otherwise, we need 2 time entry items.
            if ( dayIndex < sundayIndex ) {
                result = this.get('__AllTimeEntryItems')[0]
            } else {
                result = this.get('__AllTimeEntryItems')[1]
            }
        }
        
        return result;
    }
});