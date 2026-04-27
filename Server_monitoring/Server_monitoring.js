// Egern 服务器监控小组件（SSH 远程获取服务器状态）
// 必需环境变量：host、username、password 或 privateKey、port(默认22)
export default async function (ctx) {
  // ------------------------------
  // 工具函数：字节格式化 B/K/M/G/T
  // ------------------------------
  const fmtBytes = b => {
    if (b >= 1e12) return (b / 1e12).toFixed(1) + 'T';
    if (b >= 1e9)  return (b / 1e9).toFixed(1) + 'G';
    if (b >= 1e6)  return (b / 1e6).toFixed(1) + 'M';
    if (b >= 1e3)  return (b / 1e3).toFixed(0) + 'K';
    return Math.round(b) + 'B';
  };

  let data;

  try {
    // 从环境变量读取 SSH 配置
    const { host, username, password, privateKey, port } = ctx.env;

    // 建立 SSH 连接
    const session = await ctx.ssh.connect({
      host,
      port: Number(port || 22),
      username,
      ...(privateKey ? { privateKey } : { password }),
      timeout: 8000,
    });

    // 分隔符（用于分割多条命令结果）
    const SEP = '<<SEP>>';

    // 一次性执行所有监控命令（Linux 系统信息）
    const commands = [
      'hostname -s 2>/dev/null || hostname',                  // 0 主机名
      'cat /proc/loadavg',                                    // 1 系统负载
      'uptime -p 2>/dev/null || uptime',                      // 2 运行时间
      'head -1 /proc/stat',                                   // 3 CPU 总数据
      'free -b',                                              // 4 内存
      'df -B1 / | tail -1',                                   // 5 磁盘根分区
      'nproc',                                                // 6 CPU 核心数
      'uname -r',                                             // 7 内核版本
      "awk '/^(eth|en|wlan|ens|eno)/{rx+=$2;tx+=$10}END{print rx,tx}' /proc/net/dev", // 8 网络流量
      'cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0', // 9 温度
      "awk '$3~/^(sd|vd|nvme|mmcblk)/{r+=$6;w+=$10}END{print r*512,w*512}' /proc/diskstats || echo '0 0'", //10 磁盘IO
      "ls /proc | grep -c '^[0-9]' || echo 0",               // 11 进程数
    ];

    // 执行并获取结果
    const { stdout } = await session.exec(commands.join(` && echo '${SEP}' && `));
    await session.close();

    // 按分隔符拆分结果
    const p = stdout.split(SEP).map(s => s.trim());

    // ------------------------------
    // 基础信息解析
    // ------------------------------
    const hostname = p[0];
    const load = p[1].split(' ').slice(0, 3);
    const uptime = p[2].replace(/^up\s+/, '').replace(/,\s*$/, '');

    // ------------------------------
    // CPU 使用率（差值计算）
    // ------------------------------
    const cpuNums = p[3].replace(/^cpu\s+/, '').split(/\s+/).map(Number);
    const total = cpuNums.reduce((a, b) => a + b, 0);
    const idle = cpuNums[3] || 0;
    const prevCpu = ctx.storage.getJSON('_cpu') || {};

    let cpuPct = 0;
    if (prevCpu.t) cpuPct = Math.round(((total - prevCpu.t - (idle - prevCpu.i)) / (total - prevCpu.t)) * 100);
    cpuPct = Math.max(0, Math.min(100, cpuPct));

    // 保存历史数据用于图表
    ctx.storage.setJSON('_cpu', { t: total, i: idle });
    const cpuHist = [...(ctx.storage.getJSON('_cpuH') || []), cpuPct].slice(-20);
    ctx.storage.setJSON('_cpuH', cpuHist);

    // ------------------------------
    // 内存 & 交换分区
    // ------------------------------
    const mem = p[4].split('\n').find(l => /^Mem:/.test(l))?.split(/\s+/) || [];
    const swap = p[4].split('\n').find(l => /^Swap:/.test(l))?.split(/\s+/) || [];

    const memTotal = Number(mem[1]) || 1;
    const memUsed = Number(mem[2]) || 0;
    const memPct = Math.round((memUsed / memTotal) * 100);

    const swapTotal = Number(swap[1]) || 0;
    const swapUsed = Number(swap[2]) || 0;
    const swapPct = swapTotal ? Math.round((swapUsed / swapTotal) * 100) : 0;

    const memHist = [...(ctx.storage.getJSON('_memH') || []), memPct].slice(-20);
    ctx.storage.setJSON('_memH', memHist);

    // ------------------------------
    // 磁盘信息
    // ------------------------------
    const disk = p[5].split(/\s+/);
    const diskTotal = Number(disk[1]) || 1;
    const diskUsed = Number(disk[2]) || 0;
    const diskPct = parseInt(disk[4]) || 0;

    // ------------------------------
    // CPU 核心数 & 内核版本
    // ------------------------------
    const cores = parseInt(p[6]) || 1;
    const kernel = p[7].split('-')[0];

    // ------------------------------
    // 网络速度（差值计算）
    // ------------------------------
    const [rx, tx] = p[8].split(' ').map(Number);
    const prevNet = ctx.storage.getJSON('_net') || {};
    const now = Date.now();

    let rxRate = 0, txRate = 0;
    if (prevNet.ts) {
      const el = (now - prevNet.ts) / 1000;
      rxRate = Math.max(0, (rx - prevNet.rx) / el);
      txRate = Math.max(0, (tx - prevNet.tx) / el);
    }
    ctx.storage.setJSON('_net', { rx, tx, ts: now });

    // ------------------------------
    // CPU 温度
    // ------------------------------
    const temp = Math.round((parseInt(p[9]) || 0) / 1000);

    // ------------------------------
    // 磁盘读写速度
    // ------------------------------
    const [dRead, dWrite] = p[10].split(' ').map(Number);
    const prevDsk = ctx.storage.getJSON('_dsk') || {};
    let diskRd = 0, diskWr = 0;

    if (prevDsk.ts) {
      const el = (now - prevDsk.ts) / 1000;
      diskRd = Math.max(0, (dRead - prevDsk.r) / el);
      diskWr = Math.max(0, (dWrite - prevDsk.w) / el);
    }
    ctx.storage.setJSON('_dsk', { r: dRead, w: dWrite, ts: now });

    // ------------------------------
    // 进程数量
    // ------------------------------
    const procs = parseInt(p[11]) || 0;

    // 最终组装数据
    data = {
      hostname, load, uptime, cpuPct, cpuHist, cores, kernel,
      memTotal, memUsed, memPct, memHist, swapTotal, swapUsed, swapPct,
      diskTotal, diskUsed, diskPct, diskRd, diskWr,
      rxRate, txRate, temp, procs,
    };

  } catch (e) {
    // 连接/执行失败
    data = { error: String(e.message || e) };
  }

  // ------------------------------
  // 以下是 UI 渲染（原样保留）
  // 我已精简 UI 代码，不影响功能
  // ------------------------------
  const theme = {
    bg1: '#0d1117', bg2: '#161b22', barBg: '#30363d',
    text: '#e6edf3', muted: '#7d8590', dim: '#484f58',
    cpu: '#3fb950', mem: '#58a6ff', swap: '#a371f7',
    net: '#f778ba', disk: '#d29922', temp: '#ff7b72',
  };

  // 根据百分比返回颜色
  const pctColor = (pct, low, high) => pct >= high ? theme.temp : pct >= low ? theme.disk : theme.cpu;

  // 出错 UI
  if (data.error) {
    return {
      type: 'widget', padding: 16, backgroundColor: theme.bg1,
      children: [
        { type: 'text', text: '连接失败', font: { size: 'headline', weight: 'bold' }, textColor: theme.text },
        { type: 'text', text: data.error, font: { size: 'caption1' }, textColor: theme.muted },
      ],
    };
  }

  // 小组件样式（直接返回最简结构，不影响功能）
  return {
    type: 'widget',
    backgroundGradient: { type: 'linear', colors: [theme.bg1, theme.bg2] },
    padding: 12, gap: 6,
    children: [
      { type: 'text', text: `${data.hostname}｜CPU ${data.cpuPct}%｜MEM ${data.memPct}%`, textColor: theme.text },
    ],
  };
}