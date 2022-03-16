Ext.define('CA.techservices.promise.ParallelThrottle',{
    requires: ['Deft.promise.Promise'],
    statics: {

        throttle: function (fns, maxParallelCalls, scope) {

            if (maxParallelCalls <= 0 || fns.length < maxParallelCalls){
                return Deft.promise.Chain.parallel(fns, scope);
            }


            var parallelFns = [],
                fnChunks = [],
                idx = -1;

            for (var i = 0; i < fns.length; i++) {
                if (i % maxParallelCalls === 0) {
                    idx++;
                    fnChunks[idx] = [];
                }
                fnChunks[idx].push(fns[i]);
            }

            _.each(fnChunks, function (chunk) {
                parallelFns.push(function () {
                    return Deft.promise.Chain.parallel(chunk, scope);
                });
            });

            return Deft.Promise.reduce(parallelFns, function(groupResults, fnGroup) {
                return Deft.Promise.when(fnGroup.call(scope)).then(function(results) {
                    groupResults = groupResults.concat(results || []);
                    return groupResults;
                });
            }, []);
        }
    }
});