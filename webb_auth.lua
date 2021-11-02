--[==[

	webb | session-based authentication
	Written by Cosmin Apreutesei. Public Domain.

SESSIONS

	login([auth][, switch_user]) -> usr       login
	usr([field|'*']) -> val | t | usr         get current user field(s) or id
	admin([role]) -> t|f                      user has admin rights or role
	touch_usr()                               update user's atime
	gen_auth_token(email) -> token            generate a one-time long-lived auth token
	gen_auth_code('email', email) -> code     generate a one-time short-lived auth code
	gen_auth_code('phone', phone) -> code     generate a one-time short-lived auth code

CONFIG

	config('session_cookie_name', 'session')  name of the session cookie
	config('session_secret')                  for encrypting session cookies
	config('pass_salt')                       for encrypting passwords in db
	config('auto_create_user', true)          auto-create an anonymous users

	config('auth_token_lifetime', 3600)       forgot-password token lifetime
	config('auth_token_maxcount', 2)          max unexpired tokens allowed
	config('auth_code_lifetime', 300)         forgot-password token lifetime
	config('auth_code_maxcount', 6)           max unexpired tokens allowed

	auth_create_tables()                      create usr & session tables

API DOCS

	login([auth][, switch_user]) -> usr | nil, err, errcode

	Login using an auth object (see below).

usr() -> usr | nil, err, errcode

	Get the current user id. Same as calling `login()` without args but
	caches the usr so it can be called multiple times without actually
	performing the login.

usr(field) -> v | nil, err, errcode

	Get the value of a a specific field from the user info.

usr'*' -> t | nil, err, errcode

	Get full user info.

admin([role]) -> t|f

	Returns true if the user has the admin rights or a certain role.

touch_usr()

	Update user's access time. Call it on every request as a way of tracking
	user activity, eg. for knowing when to send those annoying "forgot items
	in your cart" emails.

gen_auth_token(email) -> token

	Generate a long-lived authentication token to be put in a link and sent
	in a forgot-password email, and used once with 'token' auth type.
	Using it also validates the email that it was generated for.
	Errors:
		'email_not_found' - no account with this email.
		'too_many_tokens' - auth_token_maxcount limit reached.

gen_auth_code('email', email) -> code
gen_auth_code('phone', phone) -> code

	Generate a 6-digit short-lived authentication code to be sent via
	email or phone and be used back once with 'code' auth type.
	If there's no user account with that email/phone, a new one is created.
	Using it also validates the phone or email that it was generated for.
	Errors:
		'too_many_tokens' - auth_code_maxcount limit reached.

AUTH OBJECT

{type = 'session'}

	login using session cookie (default). if there's no session cookie
	or it's invalid, an anonymous user is created subject to auto_create_user.

{type = 'logout'}

	Clears the session cookie and creates an anonymous user and returns it.

{type = 'anonymous'}

	login using session cookie but logout and create an anonymous user
	if the logged in user is not anonymous.

{type = 'pass', action = 'login', email = , pass = }

	login to an existing user using its email and password.
	errors:
		'user_pass' - the email or password is wrong.

{type = 'pass', action = 'create', email = , pass = }

	create a user and login to it.
	errors:
		'email_taken' - email already used on another account.

{type = 'nopass', email = }

	login using only user.

{type = 'update', email = , phone = , pass = , name = }

	update the info of the currently logged in user.
	errors:
		'email_taken' - email already used on another account.
		'phone_taken' - phone already used on another account.

{type = 'token', token = }

	login using a temporary token that was generated by a remember password
	form. a token can be used only once.
	errors:
		'invalid_token'` - token was not found or expired.

{type = 'code', code = }

	login using a temporary 6-digit code that was generated by a sign-in form.
	a sign-in code can be used only once.
	errors:
		'invalid_code' - code was not found or expired.

{type = 'facebook', access_token = }

	login using facebook authentication. user's fields `email`, `facebookid`,
	`name`, and `gender` are also updated.

{type = 'google', access_token = }

	login using google authentication. user's fields `email`, `googleid`,
	`gimgurl` and `name` are also updated.

USER SWITCHING

Regardless of how the user is authenticated, the session cookie is
updated and it will be sent with the reply. If there was already a user
logged in before and it was a different user, the callback
`switch_user(new_usr, old_usr)` is called. If that previous user was
anonymous then that user is also deleted afterwards.

]==]

require'sha2'
local hmac = require'hmac'
local glue = require'glue'

require'webb'
require'webb_query'
require'webb_action'

local function fullname(firstname, lastname)
	return glue.catargs('', firstname, lastname):trim()
end

--install --------------------------------------------------------------------

function auth_create_tables()

	query[[
	$table usr (
		usr         $pk,
		anonymous   $bool1,
		email       $email,
		emailvalid  $bool,
		pass        $hash,
		facebookid  $name,
		googleid    $name,
		gimgurl     $url, --google image url
		active      $bool1,
		title       $name,
		name        $name,
		phone       $name,
		phonevalid  $bool,
		sex         enum('M', 'F'),
		birthday    date,
		newsletter  $bool,
		roles       text,
		note        text,
		clientip    $name, --when it was created
		atime       $atime, --last access time
		ctime       $ctime, --creation time
		mtime       $mtime  --last modification time
	);
	]]

	query[[
	$table sess (
		token       $hash not null primary key,
		usr         $id not null, $fk(sess, usr, usr, usr, cascade),
		expires     timestamp not null,
		clientip    $name, --when it was created
		ctime       $ctime
	);
	]]

	query[[
	$table usrtoken (
		token       $hash not null primary key,
		usr         $id not null, $fk(usrtoken, usr, usr),
		expires     timestamp not null,
		validates   enum('email', 'phone') not null,
		ctime       $ctime
	);
	]]

end

--session cookie -------------------------------------------------------------

local function session_hash(sid)
	local secret = assert(config'session_secret')
	assert(#secret >= 32, 'session_secret too short')
	return glue.tohex(hmac.sha256(sid, secret))
end

local function save_session(sess)
	local session_cookie_name = config('session_cookie_name', 'session')
	sess.expires = sess.expires or time() + 2 * 365 * 24 * 3600 --2 years
	if sess.usr then --login
		if not sess.id then
			sess.id = glue.tohex(random_string(16))
			query([[
				insert into sess
					(token, expires, usr)
				values
					(?, from_unixtime(?), ?)
			]],
				sess.id,
				sess.expires,
				sess.usr
			)
		else
			query([[
				update sess set
					usr = ?,
					expires = from_unixtime(?)
				where
					token = ?
			]], sess.usr, sess.expires, sess.id)
		end
		local sig = session_hash(sess.id)
		setheader('set-cookie', {
			[session_cookie_name] = {
				value = '1|'..sess.id..'|'..sig,
				attrs = {
					Domain = host(),
					Expires = sess.expires,
					Secure = true,
					HttpOnly = true,
				},
			},
		})
	elseif sess.id then --logout
		query('delete from sess where token = ?', sess.id)
		setheader('set-cookie', {
			[session_cookie_name] = {
				value = '0',
				attrs = {
					Expires = 0,
					Secure = true,
					HttpOnly = true,
				},
			},
		})
	end
end

local function load_session()
	local cookies = headers('cookie'); if not cookies then return end
	local session_cookie_name = config('session_cookie_name', 'session')
	local s = cookies[session_cookie_name]; if not s then return end
	local ver, s = s:match'^(%d)|(.*)$'; if not ver then return end
	ver = tonumber(ver); if not ver then return end
	if ver == 1 then
		local sid, sig = s:match'^(.-)|(.*)$'; if not sid then return end
		if session_hash(sid) ~= sig then return end
		local usr = first_row([[
			select usr from sess where token = ? and expires > now()
		]], sid)
		if not usr then return end
		return {id = sid, usr = usr}
	end
end
local session = once(function()
	return load_session() or {}
end)

local function session_usr()
	return session().usr
end

local clear_usr_cache --fw. decl

local function save_usr(usr)
	local sess = session()
	if not sess.id or sess.usr ~= usr then
		sess.usr = usr
		save_session(sess)
		clear_usr_cache()
	end
end

--authentication frontend ----------------------------------------------------

local auth = {} --auth.<type>(auth) -> usr, can_create

local function authenticate(a)
	assert(type(a) == 'nil' or type(a) == 'table')
	webb.dbg('auth', 'auth', '%s', pp.format(a))
	local usr, err, errcode = auth[a and a.type or 'session'](a)
	if usr then
		webb.note('auth', 'auth-ok', 'usr=%d', usr)
		return usr
	else
		webb.note('auth', 'auth-fail', '%s %s', errcode, err)
		return nil, err, errcode
	end
end

local function userinfo(usr)
	if not usr then return {} end
	local t = first_row([[
		select
			usr,
			anonymous,
			email,
			emailvalid,
			if(pass is not null, 1, 0) as haspass,
			googleid,
			facebookid,
			roles,
			name,
			phone,
			phonevalid,
			gimgurl
		from
			usr
		where
			active = 1 and usr = ?
		]], usr)
	if not t then return {} end
	t.anonymous = t.anonymous == 1
	t.emailvalid = t.emailvalid == 1
	t.haspass = tonumber(t.haspass) == 1
	t.roles = glue.index(glue.names(t.roles) or {})
	t.admin = t.roles.admin
	t.phonevalid = t.phonevalid == 1
	return t
end

local function clear_userinfo_cache(usr)
	--
end

--session-cookie authentication ----------------------------------------------

local function valid_usr(usr)
	return userinfo(usr).usr
end

local function anonymous_usr(usr)
	return userinfo(usr).anonymous and usr
end

local function create_user()
	sleep(0.1) --make filling it up a bit harder
	local usr = query([[
		insert into usr
			(clientip, atime, ctime, mtime)
		values
			(?, now(), now(), now())
	]], client_ip()).insert_id
	session().usr = usr
	return usr
end

local function auto_create_user()
	if not config('auto_create_user', true) then
		return nil
	end
	return create_user()
end

function auth.session()
	return valid_usr(session_usr()) or auto_create_user()
end

function auth.logout()
	save_usr(nil)
	return auth.session()
end

--anonymous authentication ---------------------------------------------------

function auth.anonymous()
	return anonymous_usr(session_usr()) or create_user()
end

--password authentication ----------------------------------------------------

local function pass_hash(pass)
	local salt = assert(config'pass_salt', 'pass_salt missing')
	local token = hmac.sha256(pass, salt)
	return glue.tohex(token) --64 bytes
end

local function email_pass_usr(email, pass)
	sleep(0.2) --slow down brute-forcing
	return first_row([[
		select usr from usr where
			active = 1 and email = ? and pass = ?
		]], email, pass_hash(pass))
end

local function email_usr(email)
	return first_row([[
		select usr from usr where
			email = ?
		]], email)
end

local function phone_usr(phone)
	return first_row([[
		select usr from usr where
			phone = ?
		]], phone)
end

local function delete_user(usr)
	query('delete from usr where usr = ?', usr)
end

--no-password authentication: enable only for debugging!
function auth.nopass(auth)
	if false then
		return first_row([[
			select usr from usr where
				active = 1 and email = ?
			]], auth.email)
	end
end

function auth.pass(auth)
	if auth.action == 'login' then
		local usr = email_pass_usr(auth.email, auth.pass)
		if not usr then
			return nil,
				S('invalid_email_or_pass', 'Invalid email or password'),
				'email_pass'
		else
			return usr
		end
	elseif auth.action == 'create' then
		local email = assert(json_str_arg(auth.email))
		assert(#email >= 1)
		local pass = assert(auth.pass)
		assert(type(pass) == 'string' and #pass >= 1)
		if email_usr(email) then
			return nil,
				S('email_taken', 'Email already registered'),
				'email_taken'
		end
		local usr = anonymous_usr(session_usr()) or create_user()
		query([[
			update usr set
				anonymous = 0,
				emailvalid = 0,
				email = ?,
				pass = ?
			where
				usr = ?
			]], email, pass_hash(pass), usr)
		clear_userinfo_cache(usr)
		return usr
	end
end

--one-time token or code authentication --------------------------------------

local function register_token(usr, token, validates, token_lifetime, token_maxcount)

	local now = time()
	local expires = now + token_lifetime

	--now it's a good time to garbage-collect expired tokens
	query('delete from usrtoken where expires <= from_unixtime(?)', now)

	--check if too many tokens were requested
	local n = first_row([[
		select count(1) from usrtoken where
			usr = ? and validates = ? and expires > from_unixtime(?)
		]], usr, validates, now)
	if tonumber(n) >= token_maxcount then
		return nil,
			S('too_many_tokens', 'Too many requests. Try again later.'),
			'too_many_tokens'
	end

	--add the token to db (break on collisions)
	query([[
		insert into usrtoken
			(token, usr, expires, validates, ctime)
		values
			(?, ?, from_unixtime(?), ?, from_unixtime(?))
		]], pass_hash(token), usr, expires, validates, now)

	return true
end

function gen_auth_token(email)

	local token_lifetime = config('auth_token_lifetime', 60 * 60)
	local token_maxcount = config('auth_token_maxcount', 2)

	--find the user with this email
	local usr = email_usr(email)
	if not usr then
		return nil,
			S('email_not_found', 'Email not registered'),
			'email_not_found'
	end

	local token = pass_hash(random_string(32))
	local ok, err = register_token(usr, token, 'email', token_lifetime, token_maxcount)
	webb.note('auth', 'gen-token', 'usr=%s token=%s'..(ok and '' or ' error=%s'), usr, token, err)
	return ok and token or nil, err
end

function gen_auth_code(validates, s)

	local code_lifetime = config('auth_code_lifetime', 10 * 60)
	local code_maxcount = config('auth_code_maxcount', 6)

	local usr
	if validates == 'email' then
		usr = email_usr(s)
		if not usr then
			usr = anonymous_usr(session_usr()) or create_user() --grab a new one
			query('update usr set email = ? where usr = ?', s, usr)
			clear_userinfo_cache(usr)
		end
	elseif validates == 'phone' then
		usr = phone_usr(s)
		if not usr then
			usr = anonymous_usr(session_usr()) or create_user() --grab a new one
			query('update usr set phone = ? where usr = ?', s, usr)
			clear_userinfo_cache(usr)
		end
	else
		assert(false)
	end

	local code = pass_hash(random_string(64)):gsub('[a-f]', ''):sub(1, 6)
	assert(#code == 6)
	local ok, err = register_token(usr, code, validates, code_lifetime, code_maxcount)
	webb.note('auth', 'gen-code', 'usr=%s code=%s validates=%s'..(ok and '' or ' error=%s'),
		usr, code, validates, err)
	return ok and code or nil, err
end

local function token_usr(token)
	if not token then return end
	sleep(0.2) --slow down brute-forcing
	local t = first_row([[
		select ut.usr, ut.validates from
			usrtoken ut
			inner join usr u on u.usr = ut.usr
		where
			u.active = 1 and ut.expires > now() and ut.token = ?
		]], pass_hash(token))
	if not t then return end
	return t.usr, t.validates
end

--one-time short code authentication -----------------------------------------

local function auth_token(token, auth)
	--find the user
	local usr, validates = token_usr(token)
	if not usr then
		return nil,
			S('invalid_token', 'Invalid token'),
			'invalid_token'
	end

	if validates == 'email' then
		query('update usr set emailvalid = 1, anonymous = 0 where usr = ?', usr)
		clear_userinfo_cache(usr)
	elseif validates == 'phone' then
		query('update usr set phonevalid = 1, anonymous = 0 where usr = ?', usr)
		clear_userinfo_cache(usr)
	end

	--remove the token because it's single use, and also to allow
	--the user to keep forgetting his password as much as he wants.
	query('delete from usrtoken where token = ?', pass_hash(token))

	return usr
end

function auth.token(auth)
	return auth_token(json_str_arg(auth.token))
end

function auth.code(auth)
	return auth_token(json_str_arg(auth.code))
end

--facebook authentication ----------------------------------------------------

local function facebook_usr(facebookid)
	return first_row('select usr from usr where facebookid = ?', facebookid)
end

local function facebook_graph_request(url, args)
	local res = getpage('https://graph.facebook.com'..url, {args = args})
	if res and res.status == 200 then
		local t = json_arg(res.body)
		if t and not t.error then
			return t
		end
	end
	webb.note('auth', 'facebook', 'facebook_graph_request: %s %s -> %s',
		url, pp.format(args, ' '), pp.format(res, ' '))
end

function auth.facebook(auth)
	--get info from facebook
	local t = facebook_graph_request('/v2.1/me',
		{access_token = json_str_arg(auth.access_token)})
	if not t then return end

	--grab a usr
	local usr =
		facebook_usr(t.id)
		or anonymous_usr(session_usr())
		or create_user()

	--deanonimize user and update its info
	query([[
		update usr set
			anonymous = 0,
			emailvalid = 1,
			email = ?,
			facebookid = ?,
			name = ?,
			gender = ?
		where
			usr = ?
		]], t.email, t.id, fullname(t.first_name, t.last_name), t.gender, usr)
	clear_userinfo_cache(usr)

	return usr
end

--google authentication ------------------------------------------------------

local function google_usr(googleid)
	return first_row('select usr from usr where googleid = ?', googleid)
end

local function google_api_request(url, args)
	local res = getpage('https://content.googleapis.com'..url, {args = args})
	if res and res.status == 200 then
		return json(res.body)
	end
	webb.note('auth', 'google', 'google_api_request: %s %s -> %s',
		url, pp.format(args, ' '), pp.format(res, ' '))
end

function auth.google(auth)
	--get info from google
	local t = google_api_request('/plus/v1/people/me',
		{access_token = json_str_arg(auth.access_token)})
	if not t then return end

	--grab a usr
	local usr =
		google_usr(t.id)
		or anonymous_usr(session_usr())
		or create_user()

	--deanonimize user and update its info
	query([[
		update usr set
			anonymous = 0,
			emailvalid = 1,
			email = ?,
			googleid = ?,
			gimgurl = ?,
			name = ?
		where
			usr = ?
		]],
		t.emails and t.emails[1] and t.emails[1].value,
		t.id,
		t.image and t.image.url,
		t.name and fullname(t.name.givenName, t.name.familyName),
		usr)
	clear_userinfo_cache(usr)

	return usr
end

--authentication logic -------------------------------------------------------

function login(auth, switch_user)
	switch_user = switch_user or glue.pass
	local usr, err, errcode = authenticate(auth)
	if usr then
		local susr = valid_usr(session_usr())
		if susr and usr ~= susr then
			switch_user(susr, usr)
			if anonymous_usr(susr) then
				delete_user(susr)
			end
		end
		save_usr(usr)
	end
	return usr, err, errcode
end

function usr(attr)
	local usr, err, errcode = login()
	if not usr then
		return nil, err, errcode
	end
	if attr == '*' then
		return userinfo(usr)
	elseif attr then
		return userinfo(usr)[attr]
	else
		return usr
	end
end

function clear_usr_cache() --local, fw. declared
	--
end

function admin(role)
	return userinfo(usr()).roles[role or 'admin']
end

function touch_usr()
	--only touch usr on page requests
	if args(1):find'%.' and not args(1):find'%.html$' then
		return
	end
	local usr = session_usr()
	if not usr then return end
	query([[
		update usr set
			atime = now(), mtime = mtime
		where usr = ?
	]], usr)
end

--update info (not really auth, but related) ---------------------------------

function auth.update(auth)

	local usr = allow(session_usr())
	local usr = userinfo(usr)
	allow(usr.usr)

	local email = json_str_arg(auth.email)
	local phone = json_str_arg(auth.phone)
	local pass  = json_str_arg(auth.pass)
	local name  = json_str_arg(auth.name)

	if email then
		local eusr = email_usr(email)
		if eusr and eusr ~= usr then
			return nil,
				S('email_taken', 'Email already registered'),
				'email_taken'
		end
	end

	if phone then
		local pusr = phone_usr(phone)
		if pusr and pusr ~= usr then
			return nil,
				S('phone_taken', 'Phone already registered'),
				'phone_taken'
		end
	end

	pass = pass and pass_hash(pass)

	query([[
		update usr set
			#if auth.email then
				email = :email,
				emailvalid = if(email <=> :email, 0, emailvalid),
			#endif
			#if auth.phone then
				phone = :phone,
				phonevalid = if(phone <=> :phone, 0, phonevalid),
			#endif
			#if auth.pass then
				pass = :pass,
			#endif
			#if auth.name ~= nil then
				name = :name,
			#endif
			usr = usr
		where
			usr = :usr
		]], {
			auth = auth,
			email = email, phone = phone, pass = pass, name = name,
			usr = usr,
		})

	clear_userinfo_cache(usr)
	return usr
end

--self-test ------------------------------------------------------------------

if not ... then
	require'sp'
	if false then
		srun(auth_create_tables)
	else
		local res = request{
			uri = '/login.json',
			headers = {
				cookie = {
					session = '1|ac9b46efa4058b1bd70f47143c133193|93c11a3fb3d40bdf3d36c46e49c392107ddde9fd249857c9c8a9e11a022671fb',
				},
			},
		}
		pp(res)
		srun(function()
			--query('delete from usrtoken')
			--print(gen_auth_code('email', 'admin@mysite'))
			--prq(query'select * from sess')
			--prq(query'select * from usr')
		end)
	end
end

