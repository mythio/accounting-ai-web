<template>
  <div class="home-page">
    <section class="hero">
      <div class="hero-title-row">
        <img class="hero-icon" src="/images/finance-center.png" alt="AI 财务应用中心" />
        <h1>AI 财务应用中心</h1>
      </div>
      <p>选择下方应用，开始你的 AI 之旅</p>
    </section>

    <section class="app-grid">
      <RouterLink to="/finance" class="app-card card-finance">
        <img class="app-icon" src="/images/finance-assistant.svg" alt="AI财务小助手" />
        <h2>AI 财务小助手</h2>
        <p>面向财务场景的智能问答助手，SSE 流式实时对话。</p>
        <span class="enter-tip">进入应用 →</span>
      </RouterLink>

      <RouterLink to="/manus" class="app-card card-manus">
        <img class="app-icon" src="/images/finance-super-agent.svg" alt="AI 财务超级智能体" />
        <h2>AI 财务超级智能体</h2>
        <p>通用超级智能体，帮你完成各类复杂任务。</p>
        <span class="enter-tip">进入应用 →</span>
      </RouterLink>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: 40px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.25)),
    url('/images/home-bg.png') center / cover no-repeat;
}

.hero {
  text-align: center;
}

.hero-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.hero-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(246, 168, 44, 0.28);
  flex-shrink: 0;
  object-fit: cover;
}

.hero h1 {
  font-size: 40px;
  margin: 0;
  color: #ffffff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

.hero p {
  color: rgba(255, 255, 255, 0.78);
  font-size: 16px;
  margin: 12px 0 0;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  width: 100%;
  max-width: 760px;
}

.app-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 32px 28px;
  border-radius: 20px;
  background: linear-gradient(160deg, rgba(46, 66, 88, 0.85), rgba(18, 31, 46, 0.88));
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
  box-shadow: 0 12px 32px rgba(8, 16, 26, 0.4);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.app-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(8, 16, 26, 0.5);
}

.app-icon {
  width: 64px;
  height: 64px;
  display: block;
  border-radius: 16px;
  object-fit: cover;
}

.app-card h2 {
  margin: 4px 0 0;
  font-size: 22px;
  color: #ffffff;
}

.app-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.74);
  line-height: 1.6;
}

.enter-tip {
  margin-top: 8px;
  color: #9ec5ff;
  font-weight: 600;
}
</style>
