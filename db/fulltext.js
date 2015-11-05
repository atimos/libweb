import Rx from '../rxjs/rxjs';

let Lunr = require('../lib/lunr.js/lunr.js');

export default function() {
	let index_map = new Map();

	return {
		index: function(name, cfg) {
			index_map.set(name, cfg);
			return this;
		},
		then: (resolve, reject) => {
			return new Promise(resolve => {
				for ( let [name, cfg] of index_map.entries() ) {
					index_map.set(name, new Index(cfg));
				}

				resolve(index_map);
			}).then(resolve, reject);
		}
	};
}

class Index {
	constructor(cfg) {
		this['index'] = null;
		this['cfg'] = cfg;
		this.clear();
	}

	put(entry) {
		return update_index.call(this, 'update', [entry]);
	}

	post(entry) {
		return update_index.call(this, 'add', [entry]);
	}

	post_transaction(entry) {
		return update_index.call(this, 'add', [entry], true);
	}

	put_list(entries) {
		return update_index.call(this, 'update', entries);
	}

	post_list(entries) {
		return update_index.call(this, 'add', entries);
	}

	post_list_transaction(entries) {
		return update_index.call(this, 'add', entries, true);
	}

	delete(keys = []) {
			let ref = this['cfg'].ref;
			return update_index.call(this, 'remove', (Array.isArray(keys) ? keys : [keys]).map(id => {
				return {[ref]: id};
			}));
	}

	search(query, limit = null) {
		let search_result = Rx.Observable.create(observer => {
			for ( [index, entry] of this['index'].search(query).entries() ) {
				if ( observer.isStopped || ( limit !== null && index >= limit ) ) {
					break;
				}

				observer.onNext(entry);
			}

			observer.onCompleted();
		});

		if ( limit !== null ) {
			return search_result.take(limit);
		}

		return search_result;
	}

	clear() {
		return Rx.Observable.create(observer => {
			let cfg = this['cfg'];

			this['index'] = Lunr(function() {
				this.ref(cfg.ref);

				cfg.fields
					.map(field => {
						this.field(field.name, {boost: field.boost||0});
					});
			});
			observer.onNext();
			observer.onCompleted();
		});
	}

	from_raw(data) {
		return Rx.Observable.create(observer => {
			this['index'] = Lunr.Index.load(data);
			observer.onNext();
			observer.onCompleted();
		});
	}

	to_raw_json() {
		return Rx.Observable.create(observer => {
			observer.onNext(JSON.stringify(this['index']));
			observer.onCompleted();
		});
	}

	to_raw() {
		return this.to_raw_json()
			.map(data => {
				return JSON.parse(data);
			});
	}
}

function update_index(action, data, transaction = false) {
	return Rx.Observable.create(observer => {
		let index = this['index'];

		for ( let [entry_index, entry] of data.entries() ) {
			try {
				if ( action === 'add' && index.documentStore.has(entry[this['cfg'].ref]) ) {
					throw new Error('Id ' + entry[this['cfg'].ref] + ' already exists');
				}

				index[action](entry);
				observer.onNext(entry);
			} catch (err) {
				if ( transaction === true ) {
					if ( action === 'add' ) {
						data.slice(0, entry_index).forEach(index.remove.bind(index));
					}
				}

				err.data = entry;
				observer.onError(err);
				break;
			}
		}

		observer.onCompleted();
	});
}
