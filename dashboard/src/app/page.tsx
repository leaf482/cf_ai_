'use client';

import { Header } from '@/components/Header';
import { ControlPanel } from '@/components/ControlPanel';
import { ScenarioBuilder } from '@/components/ScenarioBuilder';
import { ScenarioList } from '@/components/ScenarioList';
import { MetricsPanel } from '@/components/MetricsPanel';
import { RankingPanel } from '@/components/RankingPanel';
import { PipelineStatusPanel } from '@/components/PipelineStatusPanel';
import { LiveEventStream } from '@/components/LiveEventStream';
import { VelocityPanel } from '@/components/VelocityPanel';
import { AIChatPanel } from '@/components/AIChatPanel';

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="relative flex-1 p-6">
        <div className="mx-auto grid max-w-[100rem] w-full gap-6">
          {/* Main: Preset-based Deployment Center */}
          <section className="rounded-lg border-2 border-emerald-500/30 bg-gray-900/30 p-4">
            <ControlPanel />
          </section>

          {/* Sub: Custom Scenario Builder & Active List */}
          <section className="space-y-4 opacity-90">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Custom scenarios (advanced)
            </p>
            <ScenarioBuilder />
            <ScenarioList />
          </section>

          {/* Metrics (left, narrower) | Velocity (right) */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="min-h-[280px]">
              <MetricsPanel />
            </div>
            <div className="min-h-[280px]">
              <VelocityPanel />
            </div>
          </section>

          {/* Ranking (global + trending) */}
          <section className="h-[640px]">
            <RankingPanel />
          </section>

          {/* Bottom: Pipeline Status (left) | Live Event Stream (right) */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
              <PipelineStatusPanel />
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
              <LiveEventStream />
            </div>
          </section>

          {/* AI Assistant — Cloudflare Workers AI + Durable Object memory */}
          <section>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
              AI Assistant · Powered by Cloudflare Workers AI
            </p>
            <AIChatPanel />
          </section>
        </div>
      </main>
    </div>
  );
}
