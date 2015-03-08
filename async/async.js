'use strict';
export default function(generatorFn) {
	return (function(...args) {
		let generator = generatorFn.call(this, ...args);

		function handle(result) {
			if ( result.done ) {
				return test(result.value);
			}
			return result.value
				.then(function(result) {
					return handle(generator.next(result));
				})
				.catch(function(err) {
					return handle(generator.throw(err));
				});
		}
		return handle(generator.next());
	}());
}

function test(value) {
	return value;
}
