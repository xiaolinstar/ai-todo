/* eslint-env node */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能
        "fix", // 修复
        "docs", // 文档
        "style", // 格式（不影响代码运行）
        "refactor", // 重构
        "perf", // 性能
        "test", // 测试
        "build", // 构建系统 / 依赖
        "ci", // CI 配置
        "chore", // 杂项（不修改 src / test）
        "revert", // 回滚
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
  },
};
