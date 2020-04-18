/*

	AJAX requests
	Written by Cosmin Apreutesei. Public Domain.

	ajax(req) -> req

	req.send()
	req.abort()

	^slow(show|hide)
	^progress(p, loaded, [total])
	^upload_progress(p, loaded, [total])
	^done('success', response_object)
	^done('fail', 'timeout'|'network'|'abort')
	^done('fail', 'http', status, message, body_text)
	^success(...)
	^fail(...)

*/

function ajax(req) {

	req = update({slow_timeout: 5}, req)
	events_mixin(req)

	let xhr = new XMLHttpRequest()

	let method = req.method || (req.upload ? 'POST' : 'GET')

	xhr.open(method, req.url, true, req.user, req.pass)

	if (typeof(req.upload) == 'object') {
		req.upload = json(req.upload)
		xhr.setRequestHeader('content-type', 'application/json')
	}

	xhr.timeout = (req.timeout || 0) * 1000

	if (req.headers)
		for (let h of headers)
			xhr.setRequestHeader(h, headers[h])

	let slow_watch

	function stop_slow_watch() {
		if (slow_watch) {
			clearTimeout(slow_watch)
			slow_watch = null
		}
		if (slow_watch === false) {
			req.fire('slow', false)
			slow_watch = null
		}
	}

	function slow_timeout() {
		req.fire('slow', true)
		slow_watch = false
	}

	req.send = function() {
		slow_watch = setTimeout(slow_timeout, req.slow_timeout * 1000)
		xhr.send(req.upload)
	}

	// NOTE: only Firefox fires progress events on non-200 responses.
	xhr.onprogress = function(ev) {
		if (ev.loaded > 0)
			stop_slow_watch()
		let p = ev.lengthComputable ? ev.loaded / ev.total : .5
		req.fire('progress', p, ev.loaded, ev.total)
	}

	xhr.upload.onprogress = function(ev) {
		if (ev.loaded > 0)
			stop_slow_watch()
		let p = ev.lengthComputable ? ev.loaded / ev.total : .5
		req.fire('upload_progress', p, ev.loaded, ev.total)
	}

	xhr.ontimeout = function() {
		req.fire('done', 'fail', 'timeout')
		req.fire('fail', 'timeout')
	}

	// NOTE: only fired on network errors like connection refused!
	xhr.onerror = function() {
		req.fire('done', 'fail', 'network')
		req.fire('fail', 'network')
	}

	xhr.onabort = function() {
		req.fire('done', 'fail', 'abort')
		req.fire('fail', 'abort')
	}

	xhr.onreadystatechange = function(ev) {
		if (xhr.readyState > 1)
			stop_slow_watch()
		if (xhr.readyState == 4) {
			if (xhr.status == 200) {
				req.fire('done', 'success', xhr.response)
				req.fire('success', xhr.response)
			} else if (xhr.status) { // status is 0 for network errors, incl. timeout.
				req.fire('done', 'fail', 'http', xhr.status, xhr.statusText, xhr.responseText)
				req.fire('fail', 'http', xhr.status, xhr.statusText, xhr.responseText)
			}
		}
	}

	req.abort = function() {
		xhr.abort()
	}

	req.xhr = xhr
	return req
}

