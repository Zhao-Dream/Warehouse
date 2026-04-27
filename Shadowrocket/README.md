### [规则类型](#使用目录)

> **DOMAIN-SUFFIX**：匹配请求域名的后缀
> 
> > 如 `DOMAIN-SUFFIX,example.com,DIRECT` 可以匹配到 `a.example.com` `a.b.example.com`
> 
> **DOMAIN-KEYWORD**：匹配请求域名的关键词
> 
> > 如 `DOMAIN-KEYWORD,exa,DIRECT` 可以匹配到 `a.example.com` `a.b.example.com`
> 
> **DOMAIN-WILDCARD**：匹配请求域名，支持使用通配符 `*`、`?`
> 
> > 如 `DOMAIN-WILDCARD,a*c.example*.com,DIRECT` 可以匹配到 `abc.example123.com、aqwec.example456.com`
> 
> **DOMAIN**：匹配请求的完整域名
> 
> > 如 `DOMAIN,www.example.com,DIRECT` 只能匹配到 `www.example.com`
> 
> **USER-AGENT**：匹配用户代理字符串，支持使用通配符 `*`
> 
> > 如 `USER-AGENT,MicroMessenger*,DIRECT` 可以匹配到 `MicroMessenger Client`
> 
> **URL-REGEX**：匹配 URL 正则式
> 
> > 如 `URL-REGEX,^https?://.+/item.+,REJECT` 可以匹配到 `https://www.example.com/item/abc/123`
> 
> **IP-CIDR**：匹配 IPv4 或 IPv6 地址
> 
> > 如 `IP-CIDR,192.168.1.0/24,DIRECT` 可以匹配到IP段 `192.168.1.1～192.168.1.254`。当域名请求遇到IP类规则时，Shadowrocket会向本地DNS服务器发送查询请求，以判断主机IP是否匹配规则。若IP类规则加 `no-resolve`（如：`IP-CIDR,172.16.0.0/12,DIRECT,no-resolve`），则域名请求将会跳过此规则，不会触发本地DNS查询
> 
> **IP-ASN**：匹配 IP 地址隶属的 ASN 编号
> 
> > 如 `IP-ASN,56040,DIRECT` 可以匹配到属于China Mobile Communications Corporation网络的IP地址
> 
> **RULE-SET**：匹配规则集内容。规则集的组成部分需包含规则类型
> 
> **DOMAIN-SET**：匹配域名集内容。域名集的组成部分不包含规则类型
> 
> **SCRIPT**：匹配脚本名称
> 
> **DST-PORT**：匹配目标主机名的端口号
> 
> > 如 `DST-PORT,443,DIRECT` 可以匹配到 443 目标端口
>   
> **GEOIP**：匹配 IP 数据库
> 
> > 如 `GEOIP,CN,DIRECT` 可以匹配到归属地为CN的IP地址
> 
> **FINAL**：兜底策略
> 
> > 如 `FINAL,PROXY` 表示当其他所有规则都匹配不到时才使用 `FINAL` 规则的策略
> 
> **AND**：逻辑规则，与规则
> 
> > 如 `AND,((DOMAIN,www.example.com),(DST-PORT,123)),DIRECT` 可以匹配到 `www.example.com:123`
> 
> **NOT**：逻辑规则，非规则
> 
> > 如 `NOT,((DST-PORT,123)),DIRECT` 可以匹配到除了 `123` 端口的其他所有请求
> 
> **OR**：逻辑规则，或规则
> 
> > 如 `OR,((DST-PORT,123),(DST-PORT,456)),DIRECT` 可以匹配到 `123` 或 `456` 端口的所有请求
> 
> **PROTOCOL**：匹配传输协议类型
> 
> > `PROTOCOL` 类型不支持单独使用，只能作为子规则类型嵌套于逻辑规则当中。如 `AND,((PROTOCOL,UDP),(DST-PORT,443)),REJECT-NO-DROP`

### [规则策略](#使用目录)

> **PROXY**：代理。通过代理服务器转发流量
> 
> **DIRECT**：直连。连接不经过任何代理服务器
> 
> **REJECT**：拒绝。返回 HTTP 状态码 404，没有内容
> 
> **REJECT-DICT**：拒绝。返回 HTTP 状态码 200，内容为空的JSON对象
> 
> **REJECT-ARRAY**：拒绝。返回 HTTP 状态码 200，内容为空的JSON数组
> 
> **REJECT-200**：拒绝。返回 HTTP 状态码 200，没有内容
> 
> **REJECT-IMG**：拒绝。返回 HTTP 状态码 200，内容为 1 像素 GIF
> 
> **REJECT-TINYGIF**：拒绝。返回HTTP状态码200，内容为 1 像素 GIF
> 
> **REJECT-DROP**：拒绝。丢弃 IP 包
> 
> **REJECT-NO-DROP**：拒绝。返回 ICMP 端口不可达
> 
> 除此之外，规则策略还可以选择 `分组` `代理分组` `订阅` `服务器节点` 等
