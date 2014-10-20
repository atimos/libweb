'use strict';

// http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/8809472#8809472
export function v4(){
	let d = new Date().getTime();
	let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		let r = (d + Math.random()*16)%16 | 0;
		d = Math.floor(d/16);
		return (c=='x' ? r : (r&0x7|0x8)).toString(16);
	});
	return uuid;
}
