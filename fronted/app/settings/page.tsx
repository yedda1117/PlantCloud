"use client"

import { useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Wifi,
  Thermometer,
  Droplets,
  Sun,
  Bell,
  Shield,
  Smartphone,
  RefreshCw,
  Save,
  CheckCircle,
  Plus,
  Trash2,
  Pencil,
  Zap,
  ScrollText,
  AlertCircle,
  Clock,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Device {
  id: string
  name: string
  topic: string
  online: boolean
  latency: number | null
}

interface AutoRule {
  id: string
  name: string
  condition: string
  action: string
  enabled: boolean
}

interface PolicyLog {
  id: string
  time: string
  message: string
  type: "info" | "success" | "warning"
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const initialDevices: Device[] = [
  { id: "d1", name: "小熊派 #1（绿萝）", topic: "plant/p1/sensor", online: true, latency: 23 },
  { id: "d2", name: "小熊派 #2（多肉）", topic: "plant/p2/sensor", online: false, latency: null },
]

const initialRules: AutoRule[] = [
  {
    id: "r1",
    name: "自动补光",
    condition: "光照强度 < 300 lux 且 时间在 18:00–22:00",
    action: "开启 E53_SC1 补光灯",
    enabled: true,
  },
  {
    id: "r2",
    name: "自动通风",
    condition: "温度 > 28°C 或 湿度 > 80%",
    action: "开启 E53_IA1 风扇进行降温除湿",
    enabled: true,
  },
]

const initialLogs: PolicyLog[] = [
  { id: "l1", time: "21:00", message: "由于光照不足（210 lux），系统自动开启补光灯", type: "info" },
  { id: "l2", time: "20:30", message: "温度达到 29°C，系统自动开启风扇降温", type: "warning" },
  { id: "l3", time: "19:45", message: "补光灯已运行 45 分钟，光照恢复正常，自动关闭", type: "success" },
  { id: "l4", time: "18:10", message: "由于光照不足（180 lux），系统自动开启补光灯", type: "info" },
  { id: "l5", time: "14:20", message: "湿度达到 82%，系统自动开启风扇通风", type: "warning" },
  { id: "l6", time: "09:00", message: "系统启动，自动化策略已加载（共 2 条）", type: "success" },
]

// ─── Device Dialog ────────────────────────────────────────────────────────────
function DeviceDialog({
  open,
  device,
  onClose,
  onSave,
}: {
  open: boolean
  device: Partial<Device> | null
  onClose: () => void
  onSave: (d: Omit<Device, "id" | "online" | "latency">) => void
}) {
  const [name, setName] = useState(device?.name ?? "")
  const [topic, setTopic] = useState(device?.topic ?? "")

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{device?.id ? "编辑设备" : "绑定新设备"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground">设备名称</label>
            <Input
              className="mt-1"
              placeholder="如：小熊派 #3（薰衣草）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">MQTT 主题 / 设备 ID</label>
            <Input
              className="mt-1"
              placeholder="如：plant/p3/sensor"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => { if (name && topic) { onSave({ name, topic }); onClose() } }}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Rule Dialog ──────────────────────────────────────────────────────────────
function RuleDialog({
  open,
  rule,
  onClose,
  onSave,
}: {
  open: boolean
  rule: Partial<AutoRule> | null
  onClose: () => void
  onSave: (r: Omit<AutoRule, "id" | "enabled">) => void
}) {
  const [name, setName] = useState(rule?.name ?? "")
  const [condType, setCondType] = useState("light")
  const [condOp, setCondOp] = useState("lt")
  const [condVal, setCondVal] = useState("")
  const [enableTimeRange, setEnableTimeRange] = useState(false)
  const [startTime, setStartTime] = useState("18:00")
  const [endTime, setEndTime] = useState("22:00")
  const [actionType, setActionType] = useState("light")

  const buildCondition = () => {
    const opLabel = condOp === "lt" ? "<" : condOp === "gt" ? ">" : "="
    const metric = condType === "light" ? "光照强度" : condType === "temp" ? "温度" : "湿度"
    const unit = condType === "light" ? " lux" : condType === "temp" ? "°C" : "%"
    let cond = `${metric} ${opLabel} ${condVal}${unit}`
    if (enableTimeRange && startTime && endTime) {
      cond += ` 且 时间在 ${startTime}–${endTime}`
    }
    return cond
  }
  const buildAction = () => {
    if (actionType === "light") return "开启 E53_SC1 补光灯"
    if (actionType === "fan") return "开启 E53_IA1 风扇进行降温除湿"
    return "发送通知"
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule?.id ? "编辑策略" : "新建自动化策略"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-muted-foreground">策略名称</label>
            <Input className="mt-1" placeholder="如：夜间自动补光" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Separator />
          <p className="text-sm font-medium">如果（触发条件）</p>
          <div className="grid grid-cols-3 gap-2">
            <Select value={condType} onValueChange={setCondType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">光照强度</SelectItem>
                <SelectItem value="temp">温度</SelectItem>
                <SelectItem value="humidity">湿度</SelectItem>
              </SelectContent>
            </Select>
            <Select value={condOp} onValueChange={setCondOp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lt">小于 &lt;</SelectItem>
                <SelectItem value="gt">大于 &gt;</SelectItem>
                <SelectItem value="eq">等于 =</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="数值" value={condVal} onChange={(e) => setCondVal(e.target.value)} />
          </div>
          
          {/* 时间范围设置 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">限制时间范围</span>
              </div>
              <Switch checked={enableTimeRange} onCheckedChange={setEnableTimeRange} />
            </div>
            
            {enableTimeRange && (
              <div className="space-y-3 p-4 rounded-xl border bg-background">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">起始时间</label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">结束时间</label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>策略仅在 {startTime} 至 {endTime} 期间生效</span>
                </div>
              </div>
            )}
          </div>

          <Separator />
          <p className="text-sm font-medium">则（执行动作）</p>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">开启 E53_SC1 补光灯</SelectItem>
              <SelectItem value="fan">开启 E53_IA1 风扇</SelectItem>
              <SelectItem value="notify">发送通知</SelectItem>
            </SelectContent>
          </Select>
          {condVal && (
            <div className="p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
              预览：<span className="text-foreground font-medium">{buildCondition()}</span>，则 <span className="text-foreground font-medium">{buildAction()}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => { if (name) { onSave({ name, condition: buildCondition(), action: buildAction() }); onClose() } }}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  // Devices
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [deviceDialog, setDeviceDialog] = useState<{ open: boolean; device: Partial<Device> | null }>({ open: false, device: null })

  const addDevice = (d: Omit<Device, "id" | "online" | "latency">) => {
    setDevices((prev) => [...prev, { ...d, id: `d${Date.now()}`, online: false, latency: null }])
  }
  const updateDevice = (id: string, d: Omit<Device, "id" | "online" | "latency">) => {
    setDevices((prev) => prev.map((dev) => dev.id === id ? { ...dev, ...d } : dev))
  }
  const deleteDevice = (id: string) => setDevices((prev) => prev.filter((d) => d.id !== id))

  // Rules
  const [rules, setRules] = useState<AutoRule[]>(initialRules)
  const [ruleDialog, setRuleDialog] = useState<{ open: boolean; rule: Partial<AutoRule> | null }>({ open: false, rule: null })

  const addRule = (r: Omit<AutoRule, "id" | "enabled">) => {
    setRules((prev) => [...prev, { ...r, id: `r${Date.now()}`, enabled: true }])
  }
  const toggleRule = (id: string) => setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r))
  const deleteRule = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id))

  // Logs
  const [logs] = useState<PolicyLog[]>(initialLogs)

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background">
      <NavHeader />

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">系统设置</h1>

        <div className="space-y-6">

          {/* ── 板块一：绑定设备管理 ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-primary" />
                绑定设备管理
              </CardTitle>
              <CardDescription>管理与小熊派开发板的 MQTT 绑定，支持新增、编辑、删除</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {devices.map((dev) => (
                <div key={dev.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${dev.online ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                    <div>
                      <p className="font-medium text-sm">{dev.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{dev.topic}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={dev.online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                      {dev.online ? `已连接 · ${dev.latency}ms` : "离线"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeviceDialog({ open: true, device: dev })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteDevice(dev.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setDeviceDialog({ open: true, device: null })}>
                <Plus className="h-4 w-4 mr-2" />
                绑定新设备
              </Button>
            </CardContent>
          </Card>

          {/* ── 板块二：自动化策略管理 ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                自动化策略管理
              </CardTitle>
              <CardDescription>自定义"如果…则…"联动规则，系统将自动执行</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className={`p-4 rounded-xl border transition-colors ${rule.enabled ? "bg-muted/50" : "bg-muted/20 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{rule.name}</p>
                        <Badge variant="outline" className="text-xs">{rule.enabled ? "启用" : "停用"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-blue-600 font-medium">如果</span> {rule.condition}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-green-600 font-medium">则</span> {rule.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setRuleDialog({ open: true, rule: null })}>
                <Plus className="h-4 w-4 mr-2" />
                新建策略
              </Button>
            </CardContent>
          </Card>

          {/* ── 板块三：联动策略日志 ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" />
                联动策略日志
              </CardTitle>
              <CardDescription>系统自动执行的动作记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground">{log.time}</span>
                    </div>
                    <div className="flex items-start gap-2 flex-1">
                      {log.type === "warning" && <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />}
                      {log.type === "success" && <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                      {log.type === "info" && <Zap className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
                      <p className={`text-sm ${
                        log.type === "warning" ? "text-yellow-700" :
                        log.type === "success" ? "text-green-700" :
                        "text-foreground"
                      }`}>{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* ── 原有：环境阈值设置 ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-primary" />
                环境阈值设置
              </CardTitle>
              <CardDescription>设置环境参数的警报阈值</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">温度范围</span>
                  </div>
                  <span className="text-sm text-muted-foreground">18°C - 30°C</span>
                </div>
                <Slider defaultValue={[18, 30]} min={0} max={50} step={1} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0°C</span><span>50°C</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">湿度范围</span>
                  </div>
                  <span className="text-sm text-muted-foreground">40% - 80%</span>
                </div>
                <Slider defaultValue={[40, 80]} min={0} max={100} step={1} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span><span>100%</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">光照范围</span>
                  </div>
                  <span className="text-sm text-muted-foreground">300 - 30,000 lux</span>
                </div>
                <Slider defaultValue={[300, 30000]} min={0} max={50000} step={100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 lux</span><span>50,000 lux</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 原有：通知设置 ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                通知设置
              </CardTitle>
              <CardDescription>配置系统通知与警报</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "温度异常通知", desc: "温度超出范围时发送通知", defaultOn: true },
                { label: "湿度异常通知", desc: "湿度超出范围时发送通知", defaultOn: true },
                { label: "光照异常通知", desc: "光照超出范围时发送通知", defaultOn: true },
                { label: "植物位置异常", desc: "检测到花盆倾斜或倒下时通知", defaultOn: true },
                { label: "有人来访通知", desc: "人体红外检测到有人时通知", defaultOn: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch defaultChecked={item.defaultOn} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── 原有：系统信息 ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                系统信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: "系统版本", value: "v1.0.0" },
                  { label: "硬件版本", value: "BearPi-HM Nano" },
                  { label: "固件版本", value: "HarmonyOS 3.0" },
                  { label: "最后同步", value: "2026-04-13 10:00" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-muted/50">
                    <p className="text-muted-foreground">{item.label}</p>
                    <p className="font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg">
            <Save className="h-4 w-4 mr-2" />
            保存设置
          </Button>
        </div>
      </main>

      {/* Dialogs */}
      <DeviceDialog
        open={deviceDialog.open}
        device={deviceDialog.device}
        onClose={() => setDeviceDialog({ open: false, device: null })}
        onSave={(d) => {
          if (deviceDialog.device?.id) updateDevice(deviceDialog.device.id, d)
          else addDevice(d)
        }}
      />
      <RuleDialog
        open={ruleDialog.open}
        rule={ruleDialog.rule}
        onClose={() => setRuleDialog({ open: false, rule: null })}
        onSave={addRule}
      />
    </div>
    </AuthGuard>
  )
}
