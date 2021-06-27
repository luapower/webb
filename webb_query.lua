--[==[

	webb | mysql query function
	Written by Cosmin Apreutesei. Public Domain.

PREPROCESSOR

	sqlval(s) -> s                            quote string to SQL literal
	sqlname(s) -> s                           quote string to SQL identifier
	sqlparams(s, t) -> s                      quote query with ? and :name placeholders.
	sqlrows(rows[, opt]) -> s                 quote rows to SQL insert values list
	sql_default                               placeholder for default value
	sqlunquoted(s) -> f() -> s                generate an unquoted value to use in sqlrows()
	qsubst(typedef)                           create a substitution definition
	qmacro.<name> = f(args...)                create a macro definition

EXECUTION

	[p]query[_on]([ns,]s, args...) -> res     query and return result table (compact)
	[p]kv_query[_on]([ns,]s, args...) -> res  query and return result table (key-val)
	[p]query1[_on]([ns,]s, args...) -> t      query and return first row
	[p]iquery[_on]([ns,]s, args...) -> id     query and return insert id
	atomic(func)                              execute func in transaction

RESULT PROCESSING

	changed(res) -> t|f                       check if any rows were updated
	groupby(res, col) -> t                    group rows by a column

DDL

	create_database(name)                     create a database
	fk(tbl, col, ...)                         create a foreign key
	allow_drop([t|f]) -> t|f                  control dropping of tables and fks
	drop_fk(name)                             drop foreign key
	drop_table(name)                          drop table

DEBUGGING

	prq(rows, cols)                           pretty-print query result

]==]

require'webb'
local mysql = require'mysql_client'
local errors = require'errors'
local raise = errors.raise
local mysql_print = require'mysql_client_print'
local spp = require'sqlpp'.new()

spp.require'mysql'
spp.keywords[null] = 'null'
sql_default = spp.keyword.default
sqlval = spp.value
sqlrows = spp.rows
sqlname = spp.name
sqlparams = spp.params
qsubst = spp.subst
qmacro = spp.macro

function sqlunquoted(s)
	return function() return s end
end

--db connection --------------------------------------------------------------

local function assert_db(ret, ...)
	if ret ~= nil then
		return ret, ...
	end
	local err, errno, sqlstate = ...
	err = err:gsub('You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ', 'Syntax error: ')
	raise('db', {err = err, errno = errno, sqlstate = sqlstate, addtraceback = true},
		'%s%s%s', err,
			errno and ' ['..errno..']' or '',
			sqlstate and ' '..sqlstate or '')
end

local function pconfig(ns, k, default)
	if ns then
		return config(ns..'_'..k, config(k, default))
	else
		return config(k, default)
	end
end

local free_dbs = {} --{db->true}

local function connect(ns)
	ns = ns or false
	local cx = cx()
	local db = cx.db
	if not db then
		local dbs = free_dbs[ns]
		db = dbs and next(dbs)
		if not db then
			db = assert(mysql:new())
			cx.db = db
			local t = {
				host     = pconfig(ns, 'db_host', '127.0.0.1'),
				port     = pconfig(ns, 'db_port', 3306),
				database = pconfig(ns, 'db_name'),
				user     = pconfig(ns, 'db_user', 'root'),
				password = pconfig(ns, 'db_pass'),
			}
			log('CONNECT', '%s:%s user=%s db=%s', t.host, t.port, t.user, t.database)
			assert_db(db:connect(t))
		else
			cx.db = db
			dbs[db] = nil
		end
		on_cleanup(function()
			cx.db = nil
			attr(free_dbs, ns)[db] = true
		end)
	end
	return db
end

--query execution ------------------------------------------------------------

local function process_result(t, cols, compact)
	if cols and #cols == 1 then --single column result: return it as array
		local t0 = t
		t = {}
		if compact then
			for i,row in ipairs(t0) do
				t[i] = row[1]
			end
		else
			for i,row in ipairs(t0) do
				local k,v = next(row)
				t[i] = v
			end
		end
	end
	return t
end

local function run_query_on(ns, compact, traceq, sql, ...)
	local db = connect(ns)
	local t = type((...)) ~= 'table' and {...} or ...
	local sql, params = spp.query(sql, t)
	local qtrace = traceq and trace('QUERY', '\n%s', glue.outdent(sql))
	assert_db(db:send_query(sql))
	local t, err, cols = assert_db(db:read_result(nil, compact and 'compact'))
	t = process_result(t, cols, compact)
	if err == 'again' then --multi-result/multi-statement query
		t = {t}
		repeat
			local t1, err = assert_db(db:read_result())
			t1 = process_result(t1, cols, compact)
			t[#t+1] = t1
		until not err
	end
	if qtrace then
		qtrace('QUERY', '%s', #t > 0 and 'rows: '..#t or pp.format(t))
	end
	return t, cols, params
end

local function run_query1_on(ns, traceq, ...) --query first row (or first row/column) and close
	local rows, cols, params = run_query_on(ns, false, traceq, ...)
	local row = rows[1]
	if not row then return end
	if #cols == 1 then
		return row, params --row is actually the value
	end --first row/col
	return row, params --first row
end

local function run_iquery_on(ns, traceq, ...) --insert query: return the value of the auto_increment field.
	local t, cols, params = run_query_on(ns, true, traceq, ...)
	local id = t.insert_id
	return id ~= 0 and id or nil, params
end

function query_on     (ns, ...) return run_query_on (ns , true,  false, ...) end
function pquery_on    (ns, ...) return run_query_on (ns , true,  true , ...) end
function kv_query_on  (ns, ...) return run_query_on (ns , false, false, ...) end
function pkv_query_on (ns, ...) return run_query_on (ns , false, true , ...) end
function query1_on    (ns, ...) return run_query1_on(ns , false , ...) end
function pquery1_on   (ns, ...) return run_query1_on(ns , true  , ...) end
function iquery_on    (ns, ...) return run_iquery_on(ns , false , ...) end
function piquery_on   (ns, ...) return run_iquery_on(ns , true  , ...) end
function query        (...)     return query_on     (nil, ...) end
function pquery       (...)     return puery_on     (nil, ...) end
function kv_query     (...)     return kv_query_on  (nil, ...) end
function pkv_query    (...)     return pkv_query_on (nil, ...) end
function query1       (...)     return query1_on    (nil, ...) end
function iquery       (...)     return iquery_on    (nil, ...) end
function piquery      (...)     return piquery_on   (nil, ...) end

function atomic(func)
	query'start transaction'
	local ok, err = glue.pcall(func)
	query(ok and 'commit' or 'rollback')
	assert(ok, err)
end

--result processing ----------------------------------------------------------

function changed(res)
	return tonumber(res.message:match'Changed: (%d+)') > 0
end

function groupby(items, col)
	local t = {}
	local v
	local st
	local group_func = col
	if type(col) == 'string' or type(col) == 'number' then
		group_func = function(e) return e[col] end
	end
	for i,e in ipairs(items) do
		local v1 = group_func(e)
		if not st or v ~= v1 then
			st = {}
			t[#t+1] = st
		end
		st[#st+1] = e
		v = v1
	end
	return ipairs(t)
end

--ddl ------------------------------------------------------------------------

function allow_drop(on)
	if on ~= nil then
		spp.allow_drop = on
	else
		return spp.allow_drop
	end
end

local function with_query(f)
	return function(...)
		spp.run_query = query
		return f(...)
	end
end
create_database = with_query(spp.create_database)
fk = with_query(spp.fk)
drop_table = with_query(spp.drop_table)
drop_fk = with_query(spp.drop_fk)

--debugging ------------------------------------------------------------------

function prq(rows, cols)
	return mysql_print.result(rows, cols)
end
