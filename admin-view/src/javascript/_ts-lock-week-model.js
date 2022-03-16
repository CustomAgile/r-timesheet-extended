Ext.define('TSLockedWeek',{
    extend: 'Ext.data.Model',
        
    fields: [
        { name: '__Status', type: 'string', defaultValue: 'Unknown' }, // Open, Approved, Locked
        { name: 'WeekStartDate', type: 'date' },
        { name: '__LastUpdateBy', type: 'object' },
        { name: '__LastUpdateDate', type: 'date' },
        { name: 'Preference', type: 'object'}
    ],
    
    isSelectable: function() {
        return true;
    },
        
    getShortPreferenceKey: function() {
        // get or create and then update pref
        return Ext.String.format("{0}.{1}", 
            TSUtilities.timeLockKeyPrefix,
            TSDateUtils.getUtcIsoForLocalDate(this.get('WeekStartDate'))
        );
    },
    
    getPreferenceKey: function() {
        // get or create and then update pref
        return Ext.String.format("{0}.{1}", 
            this.getShortPreferenceKey(),
            new Date().getTime()
        );
    },
    
    lock: function() {
        var deferred = Ext.create('Deft.Deferred');
        
        var current_user = Rally.getApp().getContext().getUser();
        var status_owner = { _type: 'User', '_ref': current_user._ref, '_refObjectName': current_user._refObjectName }
        var status = "Locked";
        
        this.set('__Status', status);
        this.set('__LastUpdateBy', status_owner);
        
        var pref_key = this.getPreferenceKey();
        var status_object = {
            status: status,
            status_date: new Date(),
            status_owner: status_owner,
            week_start: TSDateUtils.getUtcIsoForLocalDate(this.get('WeekStartDate'))
        };
        
        Deft.Chain.sequence([
            function() { return this._archivePreferences(this.getShortPreferenceKey()); },
            function() { return this._makePreference(pref_key,Ext.JSON.encode(status_object)); }
        ],this).then({
            scope: this,
            success: function(results) {
                deferred.resolve(results[0]);
            },
            failure: function(msg) {
                Ext.Msg.alert("Failed to save week lock state to " + pref_key, msg);
            }
        });
        return deferred.promise;
    },
    
    unlock: function() {
        var deferred = Ext.create('Deft.Deferred');
        
        var current_user = Rally.getApp().getContext().getUser();
        var status_owner = { _type: 'User', '_ref': current_user._ref, '_refObjectName': current_user._refObjectName }
        var status = "Unlocked";
        
        this.set('__LastUpdateBy', status_owner);
        this.set('__Status', status);
        
        var pref_key = this.getPreferenceKey();
        
        var status_object = {
            status: status,
            status_date: new Date(),
            status_owner: status_owner,
            week_start: TSDateUtils.getUtcIsoForLocalDate(this.get('WeekStartDate'))
        };
        
        Deft.Chain.sequence([
            function() { return this._archivePreferences(this.getShortPreferenceKey()); },
            function() { return this._makePreference(pref_key,Ext.JSON.encode(status_object)); }
        ],this).then({
            scope: this,
            success: function(results) {
                deferred.resolve(results[0]);
            },
            failure: function(msg) {
                Ext.Msg.alert("Failed to save week lock state to " + pref_key, msg);
            }
        });
        return deferred.promise;
        
    },
    
    _archivePreferences: function(key) {
        var deferred = Ext.create('Deft.Deferred'),
            me = this;
        
        var filters = [
            {property:'Name',operator:'contains', value:key},
            {property:'Name',operator:'!contains',value:TSUtilities.archiveSuffix }
        ];
        
        var config = {
            model:'Preference',
            limit: Infinity,
            filters: filters,
            fetch: ['Name','Value']
        };
        
        TSUtilities.loadWsapiRecords(config).then({
            scope: this,
            success: function(preferences) {
                var promises = [];
                Ext.Array.each(preferences, function(preference) {
                    preference.set('Project',Rally.getApp().getSetting('preferenceProjectRef'));
                    preference.set('Name', preference.get('Name') + '.' + TSUtilities.archiveSuffix );
                    promises.push( function() { return me._savePreference(preference); });
                },this);
                
                Deft.Chain.sequence(promises).then({
                    success: function(result) {
                        deferred.resolve(result);
                    },
                    failure: function(msg) {
                        deferred.reject(msg);
                    }
                
                });
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _savePreference: function(preference) {
        var deferred = Ext.create('Deft.Deferred');
        
        preference.save({
            callback: function(result, operation) {
                if(operation.wasSuccessful()) {
                    deferred.resolve(result);
                } else {
                    
                    deferred.reject("Could not archive old status");
                }
            }
        });
        return deferred.promise;
    },
    
    /* leave prefs is null or empty array to create a pref because
     * this is pipelined from the search for a pref.  So we might have
     * gotten something and just want to pass it through
     */
    _makePreference: function(key, value) {
        var deferred = Ext.create('Deft.Deferred');
        
        Rally.data.ModelFactory.getModel({
            type: 'Preference',
            success: function(model) {
                var pref_config = {
                    Name: key,
                    Value: value
                };
                
                pref_config.Project = Rally.getApp().getSetting('preferenceProjectRef');
                
                var pref = Ext.create(model, pref_config);
                
                pref.save({
                    callback: function(result, operation) {
                        if(operation.wasSuccessful()) {
                            deferred.resolve([result]);
                        } else {
                            deferred.reject(operation.error.errors.join('. '));
                        }
                    }
                });
            }
        });
        return deferred.promise;
    }
    
});