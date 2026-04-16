import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BrainCircuit, Camera, Leaf, LockKeyhole, ShieldCheck, Sprout, Waves } from "lucide-react"

const heroImage =
  "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1800&q=82"

const plantImage =
  "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80"

const features = [
  {
    title: "人脸入口",
    text: "摄像头采集现场画面，后端使用 SmartJavaAI 提取特征并完成身份匹配。",
    icon: Camera,
  },
  {
    title: "智能养护",
    text: "温度、湿度、光照、倾倒和烟雾状态集中呈现，让植物状态更容易被看见。",
    icon: Sprout,
  },
  {
    title: "AI 问答",
    text: "知识库资料和环境数据一起参与回答，给出更贴近当前植物状态的建议。",
    icon: BrainCircuit,
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/20 bg-zinc-950/65 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400 text-zinc-950">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold">PlantCloud</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-zinc-200 md:flex">
            <a href="#platform">平台能力</a>
            <a href="#security">安全入口</a>
            <a href="#workflow">运行方式</a>
          </nav>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-zinc-950 transition hover:bg-emerald-100"
          >
            登录系统
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative min-h-[92vh] overflow-hidden text-white">
        <Image
          src={heroImage}
          alt="Greenhouse plants with soft natural light"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-zinc-950/62" />
        <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-center px-5 pb-16 pt-24 sm:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-lg border border-emerald-300/45 bg-emerald-300/15 px-3 py-1 text-sm text-emerald-100">
              面向智能植物养护的安全控制台
            </p>
            <h1 className="text-5xl font-semibold leading-[1.06] sm:text-6xl lg:text-7xl">
              PlantCloud
              <span className="block text-emerald-200">让植物状态进入云端。</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-100">
              从人脸登录到环境监测，从设备联动到养护问答，PlantCloud 把小生态箱的日常运行集中到一个清晰、可靠的入口。
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
              >
                使用人脸登录
                <Camera className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-white/40 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                注册账号与人脸
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="mx-auto grid max-w-7xl gap-5 px-5 py-16 sm:px-8 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <article key={feature.title} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <span className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-semibold">{feature.title}</h2>
              <p className="mt-3 leading-7 text-zinc-600">{feature.text}</p>
            </article>
          )
        })}
      </section>

      <section id="security" className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-emerald-700">安全入口</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              先确认身份，再进入设备与数据。
            </h2>
            <p className="mt-5 leading-8 text-zinc-600">
              登录页把人脸识别框放在视觉中心，账号密码作为备用方式。注册独立成页，避免登录流程被打断，也更适合现场采集高质量底库照片。
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="font-semibold">SmartJavaAI 识别</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">注册时写入特征库，登录时按阈值搜索最相近的人脸。</p>
              </div>
              <div className="rounded-lg border border-zinc-200 p-4">
                <LockKeyhole className="mb-3 h-5 w-5 text-cyan-700" />
                <p className="font-semibold">登录后访问</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">控制台页面会检查本地令牌，没有令牌会回到登录页。</p>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            <Image
              src={plantImage}
              alt="A close view of healthy indoor plants"
              width={900}
              height={720}
              className="h-full min-h-[360px] w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold text-emerald-700">运行方式</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">一个入口，四步进入系统。</h2>
          </div>
          <div className="grid gap-4">
            {["打开 PlantCloud 首页", "进入人脸登录", "SmartJavaAI 完成匹配", "进入植物监控主页"].map((item, index) => (
              <div key={item} className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <p className="font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white px-5 py-8 text-sm text-zinc-500 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>PlantCloud 智能植物云端养护系统</p>
          <p className="inline-flex items-center gap-2">
            <Waves className="h-4 w-4 text-cyan-700" />
            真实采集，安全识别，稳定运行
          </p>
        </div>
      </footer>
    </main>
  )
}
