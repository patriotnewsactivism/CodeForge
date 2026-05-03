/**
 * ═══════════════════════════════════════════════════════════════════
 * CODEFORGE — PRICING PAGE
 * ═══════════════════════════════════════════════════════════════════
 *
 * Beautiful pricing page with:
 * - 4 tiers: Free, Weekly, Monthly, Lifetime
 * - Feature comparison
 * - Usage meters
 * - "Founding Member" lifetime badge
 * - Stripe checkout integration (ready)
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  X,
  Zap,
  Crown,
  Rocket,
  Star,
  Shield,
  Loader2,
  ArrowLeft,
  Sparkles,
  Clock,
  Brain,
  GitBranch,
  Cpu,
  Database,
  FolderOpen,
  Bot,
  ChevronRight,
} from "lucide-react";

interface PricingPageProps {
  onBack: () => void;
}

type PlanId = "free" | "weekly" | "monthly" | "lifetime";

interface PlanConfig {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  accent: string;
  popular?: boolean;
  features: { text: string; included: boolean; highlight?: boolean }[];
  limits: {
    aiPerDay: string;
    aiPerHour: string;
    missions: string;
    agents: string;
    projects: string;
    files: string;
    budget: string;
  };
}

const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try CodeForge with basic AI coding features",
    icon: Zap,
    accent: "from-zinc-500/20 to-zinc-600/5",
    features: [
      { text: "AI-powered code generation", included: true },
      { text: "25 AI requests/day", included: true },
      { text: "3 projects", included: true },
      { text: "Basic agent system (2 concurrent)", included: true },
      { text: "Community templates", included: true },
      { text: "GitHub import", included: true },
      { text: "Unlimited missions", included: false },
      { text: "Priority model access", included: false },
      { text: "Advanced agent orchestration", included: false },
      { text: "Lifetime updates", included: false },
    ],
    limits: {
      aiPerDay: "25",
      aiPerHour: "10",
      missions: "3/day",
      agents: "2 concurrent",
      projects: "3",
      files: "50/project",
      budget: "—",
    },
  },
  {
    id: "weekly",
    name: "Weekly Pro",
    price: "$9.99",
    period: "/week",
    description: "For active builders who want more power",
    icon: Rocket,
    accent: "from-blue-500/20 to-blue-600/5",
    features: [
      { text: "Everything in Free", included: true },
      { text: "200 AI requests/day", included: true, highlight: true },
      { text: "10 projects", included: true },
      { text: "5 concurrent agents", included: true, highlight: true },
      { text: "20 missions/day", included: true },
      { text: "GitHub two-way sync", included: true },
      { text: "AI code review", included: true },
      { text: "Template marketplace", included: true },
      { text: "Advanced agent orchestration", included: false },
      { text: "Lifetime updates", included: false },
    ],
    limits: {
      aiPerDay: "200",
      aiPerHour: "50",
      missions: "20/day",
      agents: "5 concurrent",
      projects: "10",
      files: "200/project",
      budget: "$5/week cap",
    },
  },
  {
    id: "monthly",
    name: "Monthly Pro",
    price: "$29.99",
    period: "/month",
    description: "Best value for serious developers",
    icon: Crown,
    accent: "from-purple-500/20 to-purple-600/5",
    popular: true,
    badge: "MOST POPULAR",
    badgeColor: "bg-purple-500",
    features: [
      { text: "Everything in Weekly", included: true },
      { text: "500 AI requests/day", included: true, highlight: true },
      { text: "25 projects", included: true },
      { text: "10 concurrent agents", included: true, highlight: true },
      { text: "50 missions/day", included: true },
      { text: "Multi-agent debate system", included: true },
      { text: "AI architecture advisor", included: true },
      { text: "Performance profiler", included: true },
      { text: "Priority support", included: true },
      { text: "Lifetime updates", included: false },
    ],
    limits: {
      aiPerDay: "500",
      aiPerHour: "100",
      missions: "50/day",
      agents: "10 concurrent",
      projects: "25",
      files: "500/project",
      budget: "$15/month cap",
    },
  },
  {
    id: "lifetime",
    name: "Lifetime Founder",
    price: "$299.99",
    period: "one-time",
    description: "Lock in forever access. Limited to first 50 members.",
    icon: Star,
    accent: "from-amber-500/20 to-amber-600/5",
    badge: "FOUNDING MEMBER",
    badgeColor: "bg-gradient-to-r from-amber-500 to-orange-500",
    features: [
      { text: "Everything in Monthly", included: true },
      { text: "1,000 AI requests/day", included: true, highlight: true },
      { text: "100 projects", included: true },
      { text: "20 concurrent agents", included: true, highlight: true },
      { text: "100 missions/day", included: true },
      { text: "All future features forever", included: true, highlight: true },
      { text: "Founding Member badge", included: true, highlight: true },
      { text: "Direct developer access", included: true },
      { text: "Custom agent configurations", included: true },
      { text: "Never pay again", included: true, highlight: true },
    ],
    limits: {
      aiPerDay: "1,000",
      aiPerHour: "200",
      missions: "100/day",
      agents: "20 concurrent",
      projects: "100",
      files: "1,000/project",
      budget: "$50/30-day cap",
    },
  },
];

export function PricingPage({ onBack }: PricingPageProps) {
  const subscription = useQuery(api.subscriptions.getMySubscription);
  const usage = useQuery(api.subscriptions.getMyUsage);
  const upgradePlan = useMutation(api.subscriptions.upgradePlan);
  const [upgrading, setUpgrading] = useState<PlanId | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const currentPlan = subscription?.plan || "free";

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === "free" || planId === currentPlan) return;

    setUpgrading(planId);
    try {
      // TODO: Integrate Stripe checkout here
      // For now, direct upgrade (will be replaced with Stripe flow)
      await upgradePlan({ plan: planId });
      toast.success(`Upgraded to ${PLANS.find((p) => p.id === planId)?.name}!`);
    } catch (e) {
      toast.error("Upgrade failed. Please try again.");
    }
    setUpgrading(null);
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-y-auto">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-purple-500/[0.04] to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-gradient-radial from-amber-500/[0.03] to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Editor
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs px-3 py-1">
              <Sparkles className="h-3 w-3 mr-1" />
              Launch Pricing — Limited Time
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Build Faster with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-amber-400">
                AI Agents
              </span>
            </h1>
            <p className="text-white/30 max-w-xl mx-auto text-sm sm:text-base">
              CodeForge deploys autonomous AI agents that write, test, and ship your code.
              Choose the plan that matches your ambition.
            </p>
          </motion.div>
        </div>

        {/* Current Usage (if logged in) */}
        {usage && subscription && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 max-w-2xl mx-auto"
          >
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white/50">
                  Your Usage Today — {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "AI Requests",
                    value: usage.daily.aiRequests,
                    max: subscription.maxAiRequestsPerDay || 25,
                    icon: Brain,
                  },
                  {
                    label: "Missions",
                    value: usage.daily.missionsLaunched,
                    max: subscription.maxMissionsPerDay || 3,
                    icon: Rocket,
                  },
                  {
                    label: "Tokens Used",
                    value: usage.daily.tokensUsed,
                    max: null,
                    icon: Cpu,
                  },
                  {
                    label: "Cost Today",
                    value: `$${((usage.daily.computeCostCents || 0) / 100).toFixed(2)}`,
                    max: subscription.monthlyComputeBudgetCents
                      ? `$${(subscription.monthlyComputeBudgetCents / 100).toFixed(0)} cap`
                      : null,
                    icon: Database,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-white/20">
                      <stat.icon className="h-3 w-3" />
                      {stat.label}
                    </div>
                    <div className="text-sm font-bold text-white/60">
                      {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                      {stat.max !== null && typeof stat.max === "number" && (
                        <span className="text-white/15 font-normal"> / {stat.max.toLocaleString()}</span>
                      )}
                      {stat.max !== null && typeof stat.max === "string" && (
                        <span className="text-white/15 font-normal text-[10px]"> ({stat.max})</span>
                      )}
                    </div>
                    {stat.max !== null && typeof stat.max === "number" && typeof stat.value === "number" && (
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            stat.value / stat.max > 0.8 ? "bg-red-500" : stat.value / stat.max > 0.5 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min((stat.value / stat.max) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {PLANS.map((plan, i) => {
            const isCurrent = plan.id === currentPlan;
            const isDowngrade = 
              (currentPlan === "lifetime") ||
              (currentPlan === "monthly" && (plan.id === "free" || plan.id === "weekly")) ||
              (currentPlan === "weekly" && plan.id === "free");

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "relative rounded-2xl border overflow-hidden",
                  plan.popular
                    ? "border-purple-500/30 bg-purple-500/[0.03]"
                    : "border-white/[0.06] bg-white/[0.01]",
                  isCurrent && "ring-2 ring-emerald-500/30"
                )}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className={cn("absolute top-0 right-0 px-2.5 py-0.5 text-[9px] font-bold text-white rounded-bl-lg", plan.badgeColor)}>
                    {plan.badge}
                  </div>
                )}

                {/* Gradient top */}
                <div className={cn("h-1 bg-gradient-to-r", plan.accent)} />

                <div className="p-5">
                  {/* Icon + Name */}
                  <div className="flex items-center gap-2 mb-3">
                    <plan.icon className={cn("h-5 w-5", plan.popular ? "text-purple-400" : "text-white/30")} />
                    <h3 className="font-bold text-sm text-white/70">{plan.name}</h3>
                    {isCurrent && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] ml-auto">
                        CURRENT
                      </Badge>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    <span className="text-2xl font-extrabold text-white/80">{plan.price}</span>
                    <span className="text-xs text-white/20 ml-1">{plan.period}</span>
                  </div>

                  <p className="text-[11px] text-white/20 mb-4 leading-relaxed">{plan.description}</p>

                  {/* CTA */}
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent || isDowngrade || upgrading !== null}
                    className={cn(
                      "w-full h-9 text-xs font-semibold mb-4",
                      isCurrent
                        ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                        : plan.popular
                          ? "bg-purple-600 hover:bg-purple-500 text-white"
                          : plan.id === "lifetime"
                            ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
                            : "bg-white/5 hover:bg-white/10 text-white/50"
                    )}
                  >
                    {upgrading === plan.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : isDowngrade ? (
                      "—"
                    ) : plan.id === "free" ? (
                      "Get Started"
                    ) : (
                      <>Upgrade <ChevronRight className="h-3 w-3 ml-1" /></>
                    )}
                  </Button>

                  {/* Features */}
                  <div className="space-y-1.5">
                    {plan.features.map((f, j) => (
                      <div key={j} className="flex items-start gap-2">
                        {f.included ? (
                          <Check className={cn("h-3 w-3 mt-0.5 shrink-0", f.highlight ? "text-emerald-400" : "text-white/15")} />
                        ) : (
                          <X className="h-3 w-3 mt-0.5 shrink-0 text-white/[0.06]" />
                        )}
                        <span className={cn(
                          "text-[10px] leading-relaxed",
                          f.included ? (f.highlight ? "text-white/40" : "text-white/20") : "text-white/[0.08]"
                        )}>
                          {f.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Limits Quick View */}
                <div className="px-5 pb-4 pt-2 border-t border-white/[0.03]">
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { label: "AI/day", value: plan.limits.aiPerDay },
                      { label: "Agents", value: plan.limits.agents },
                      { label: "Missions", value: plan.limits.missions },
                      { label: "Budget", value: plan.limits.budget },
                    ].map((l) => (
                      <div key={l.label} className="text-[9px]">
                        <span className="text-white/10">{l.label}: </span>
                        <span className="text-white/25 font-medium">{l.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Cost Protection Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 p-6">
            <Shield className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-white/60 mb-2">Built-In Cost Protection</h3>
            <p className="text-[11px] text-white/25 leading-relaxed max-w-md mx-auto">
              Every plan has hard spend caps that <strong className="text-white/40">cannot be exceeded</strong>.
              Hourly rate limits prevent burst abuse. Daily caps reset at midnight UTC. Your
              bill will <strong className="text-white/40">never exceed your plan price</strong> — guaranteed.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {[
                { icon: Clock, text: "Hourly rate limits" },
                { icon: Shield, text: "Hard spend caps" },
                { icon: Bot, text: "Concurrent agent limits" },
                { icon: Database, text: "Compute budget enforcement" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-1.5 text-[10px] text-emerald-400/40">
                  <item.icon className="h-3 w-3" />
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Comparison Table Toggle */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-xs text-white/20 hover:text-white/40 transition-colors"
          >
            {showComparison ? "Hide" : "Show"} Detailed Comparison →
          </button>
        </div>

        {/* Comparison Table */}
        <AnimatePresence>
          {showComparison && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-16"
            >
              <div className="max-w-4xl mx-auto overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-2 px-3 text-white/20 font-medium">Feature</th>
                      {PLANS.map((p) => (
                        <th key={p.id} className="text-center py-2 px-3 text-white/30 font-semibold">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: "AI Requests/Day", values: ["25", "200", "500", "1,000"] },
                      { feature: "AI Requests/Hour", values: ["10", "50", "100", "200"] },
                      { feature: "Missions/Day", values: ["3", "20", "50", "100"] },
                      { feature: "Concurrent Agents", values: ["2", "5", "10", "20"] },
                      { feature: "Projects", values: ["3", "10", "25", "100"] },
                      { feature: "Files/Project", values: ["50", "200", "500", "1,000"] },
                      { feature: "Compute Budget", values: ["—", "$5/wk", "$15/mo", "$50/30d"] },
                      { feature: "GitHub Import", values: ["✓", "✓", "✓", "✓"] },
                      { feature: "GitHub Sync", values: ["—", "✓", "✓", "✓"] },
                      { feature: "AI Review", values: ["—", "✓", "✓", "✓"] },
                      { feature: "Multi-Agent Debate", values: ["—", "—", "✓", "✓"] },
                      { feature: "Arch Advisor", values: ["—", "—", "✓", "✓"] },
                      { feature: "Perf Profiler", values: ["—", "—", "✓", "✓"] },
                      { feature: "Custom Agents", values: ["—", "—", "—", "✓"] },
                      { feature: "Founding Badge", values: ["—", "—", "—", "✓"] },
                      { feature: "Future Features", values: ["—", "—", "—", "✓"] },
                    ].map((row) => (
                      <tr key={row.feature} className="border-b border-white/[0.02]">
                        <td className="py-1.5 px-3 text-white/20">{row.feature}</td>
                        {row.values.map((v, i) => (
                          <td key={i} className={cn(
                            "py-1.5 px-3 text-center",
                            v === "✓" ? "text-emerald-400" : v === "—" ? "text-white/[0.06]" : "text-white/25"
                          )}>
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-4 mb-16">
          <h2 className="text-center text-sm font-bold text-white/40 mb-6">Common Questions</h2>
          {[
            {
              q: "Can someone run up my costs by using the platform non-stop?",
              a: "No. Every plan has hard compute budget caps enforced at the backend level. Once a user hits their daily AI request limit OR their compute budget ceiling, all AI operations are paused until the next period. This cannot be bypassed.",
            },
            {
              q: "What happens when I hit my limit?",
              a: "You'll see a clear notification that you've reached your limit. AI features pause but you can still edit code, browse files, and manage projects. Limits reset at midnight UTC each day.",
            },
            {
              q: "What does the Lifetime plan include?",
              a: "One payment, forever access. You get the highest limits (1,000 AI requests/day, 20 concurrent agents), a Founding Member badge, and every future feature we ever build — all included. Limited to the first 50 members.",
            },
            {
              q: "Can I upgrade or downgrade anytime?",
              a: "Yes. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.",
            },
          ].map((faq, i) => (
            <div key={i} className="rounded-lg bg-white/[0.01] border border-white/[0.04] p-4">
              <p className="text-[11px] font-semibold text-white/40 mb-1">{faq.q}</p>
              <p className="text-[10px] text-white/20 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
