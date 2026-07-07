import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitStatus, VersionHistoryEntry, FileChange, FileDiff, GitStashEntry } from '@baishou/shared'
import type { GitManagementPageProps, GitBranchInfo } from './git-management.types'
import { useGitManagementCommit } from './useGitManagementCommit'
import { useGitManagementWorkspace } from './useGitManagementWorkspace'

export function useGitManagementPage(props: GitManagementPageProps) {
  const {
    config,
    onSaveConfig,
    onInit,
    isInitialized,
    onTestRemote,
    onCommit,
    onCommitAll,
    onToast,
    onGetStatus,
    onGetHistory,
    onGetRecentPulls,
    onGetCommitChanges,
    onGetFileDiff,
    onGetWorkingDiff,
    onStageFile,
    onStageAll,
    onUnstageFile,
    onUnstageAll,
    onDiscardFile,
    onDiscardAllChanges,
    onPush,
    onPull,
    onResolveConflict,
    onRollbackFile,
    onRollbackAll,
    onGetRollbackAllContext,
    onGetBranchInfo,
    onCheckoutBranch,
    onCreateBranch,
    onSetRemoteUrl,
    onMergeBranch,
    onDeleteBranch,
    onPublishBranch,
    onListStash,
    onStashPush,
    onStashApply,
    onStashPop,
    onStashDrop,
    onOpenDiffInEditor,
    onOpenCommitDiffInEditor
  } = props
  const { t } = useTranslation()

  const [tab, setTab] = useState<'config' | 'version'>('config')
  const [remoteUrl, setRemoteUrl] = useState(config.remote?.url || '')
  const [remoteBranch, setRemoteBranch] = useState(config.remote?.branch || 'main')
  const [remoteUsername, setRemoteUsername] = useState(config.remote?.username || '')
  const [remoteToken, setRemoteToken] = useState(config.remote?.token || '')
  const [userName, setUserName] = useState(config.userName || '')
  const [userEmail, setUserEmail] = useState(config.userEmail || '')
  const [showPassword, setShowPassword] = useState(false)

  // 工作区状态
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)

  // 可折叠区域
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    staged: true,
    changes: true,
    commits: true,
    pulls: true
  })

  // 历史记录
  const [history, setHistory] = useState<VersionHistoryEntry[]>([])
  const [recentPulls, setRecentPulls] = useState<VersionHistoryEntry[]>([])
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [commitChanges, setCommitChanges] = useState<FileChange[]>([])
  const [selectedFileDiff, setSelectedFileDiff] = useState<FileDiff | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [expandedWorkingFile, setExpandedWorkingFile] = useState<{
    path: string
    staged: boolean
  } | null>(null)
  const [workingFileDiff, setWorkingFileDiff] = useState<FileDiff | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [commitMessage, setCommitMessage] = useState('')
  const [branchInfo, setBranchInfo] = useState<GitBranchInfo | null>(null)
  const [stashList, setStashList] = useState<GitStashEntry[]>([])

  useEffect(() => {
    setRemoteUrl(config.remote?.url || '')
    setRemoteBranch(config.remote?.branch || 'main')
    setRemoteUsername(config.remote?.username || '')
    setRemoteToken(config.remote?.token || '')
    setUserName(config.userName || '')
    setUserEmail(config.userEmail || '')
  }, [config])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const handleLoadStash = useCallback(async () => {
    if (!onListStash) {
      setStashList([])
      return
    }
    try {
      setStashList(await onListStash())
    } catch {
      setStashList([])
    }
  }, [onListStash])

  const handleRefreshStatus = useCallback(async () => {
    try {
      const status = await onGetStatus()
      setGitStatus(status)
    } catch {
      // 静默失败
    }
    if (onGetBranchInfo && isInitialized) {
      try {
        setBranchInfo(await onGetBranchInfo())
      } catch {
        setBranchInfo(null)
      }
    }
    await handleLoadStash()
  }, [onGetStatus, onGetBranchInfo, isInitialized, handleLoadStash])

  const handleLoadHistory = useCallback(async () => {
    try {
      const offset = (page - 1) * pageSize
      const entries = await onGetHistory(undefined, pageSize, offset)
      setTotalCount(
        entries.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + entries.length
      )
      setHistory(entries)
    } catch {
      onToast(t('version_control.load_history_failed', '加载历史失败'), 'error')
    }
  }, [onGetHistory, page, pageSize, onToast, t])

  const handleLoadRecentPulls = useCallback(async () => {
    try {
      const pulls = await onGetRecentPulls(10)
      setRecentPulls(pulls)
    } catch {
      // 静默失败
    }
  }, [onGetRecentPulls])

  const handleInit = useCallback(async () => {
    const result = await onInit()
    if (result.success) {
      onToast(t('version_control.git_init_success', 'Git 仓库初始化成功'), 'success')
      handleRefreshStatus()
    } else {
      onToast(result.message || t('version_control.git_init_failed', '初始化失败'), 'error')
    }
  }, [onInit, onToast, t, handleRefreshStatus])

  const handleSaveAuthorConfig = useCallback(async () => {
    try {
      await Promise.resolve(
        onSaveConfig({
          userName: userName || undefined,
          userEmail: userEmail || undefined
        })
      )
      onToast(t('common.save_success', '保存成功'), 'success')
    } catch (e: any) {
      onToast(e?.message || t('common.error', '保存失败'), 'error')
    }
  }, [userName, userEmail, onSaveConfig, onToast, t])

  const handleSaveRemoteConfig = useCallback(async () => {
    try {
      await Promise.resolve(
        onSaveConfig({
          remote: remoteUrl
            ? {
                url: remoteUrl,
                branch: remoteBranch,
                username: remoteUsername || undefined,
                token: remoteToken || undefined
              }
            : undefined
        })
      )
      onToast(t('common.save_success', '保存成功'), 'success')
    } catch (e: any) {
      onToast(e?.message || t('common.error', '保存失败'), 'error')
    }
  }, [remoteUrl, remoteBranch, remoteUsername, remoteToken, onSaveConfig, onToast, t])

  const handleTestRemote = useCallback(async () => {
    const ok = await onTestRemote()
    onToast(
      ok
        ? t('version_control.connection_success', '连接成功')
        : t('version_control.connection_failed', '连接失败'),
      ok ? 'success' : 'error'
    )
  }, [onTestRemote, onToast, t])

  const handlePush = useCallback(async () => {
    const result = await onPush()
    onToast(
      result.success
        ? t('version_control.push_success', '推送成功')
        : result.message || t('version_control.git_push_failed', '推送失败'),
      result.success ? 'success' : 'error'
    )
    if (result.success) {
      await handleRefreshStatus()
    }
  }, [onPush, onToast, t, handleRefreshStatus])

  const stagedCount = gitStatus?.staged.length ?? 0
  const unstagedCount = (gitStatus?.unstaged.length ?? 0) + (gitStatus?.untracked.length ?? 0)
  const canCommit = stagedCount > 0 || unstagedCount > 0
  const canCommitStaged = stagedCount > 0

  const { handleManualCommit, handleCommitAll, handleCommitAndPush } = useGitManagementCommit({
    t,
    commitMessage,
    setCommitMessage,
    onCommit,
    onCommitAll,
    onPush,
    onToast,
    handleRefreshStatus,
    handleLoadHistory,
    setSelectedCommit,
    setCommitChanges,
    setSelectedFileDiff
  })

  const handlePull = useCallback(async () => {
    const result = await onPull()
    if (result.success) {
      onToast(t('version_control.pull_success', '拉取成功'), 'success')
      handleRefreshStatus()
      handleLoadHistory()
    } else {
      onToast(result.message || t('version_control.git_pull_failed', '拉取失败'), 'error')
      if (result.conflicts) {
        setConflicts(result.conflicts)
      }
    }
  }, [onPull, onToast, t, handleRefreshStatus, handleLoadHistory])

  const handleCheckoutBranch = useCallback(
    async (branch: string) => {
      if (!onCheckoutBranch) return
      const result = await onCheckoutBranch(branch)
      if (result.success) {
        onToast(t('workbench.git_branch_switched', '已切换分支'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onCheckoutBranch, onToast, t, handleRefreshStatus]
  )

  const handleCreateBranch = useCallback(
    async (branch: string) => {
      if (!onCreateBranch) return
      const trimmed = branch.trim()
      if (!trimmed) return
      const result = await onCreateBranch(trimmed)
      if (result.success) {
        onToast(t('workbench.git_branch_created', '已创建分支'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onCreateBranch, onToast, t, handleRefreshStatus]
  )

  const handleSetRemoteUrl = useCallback(
    async (url: string) => {
      if (!onSetRemoteUrl) return
      const trimmed = url.trim()
      if (!trimmed) return
      const result = await onSetRemoteUrl(trimmed)
      if (result.success) {
        onToast(t('workbench.git_remote_saved', '远程地址已保存'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onSetRemoteUrl, onToast, t, handleRefreshStatus]
  )

  const handleMergeBranch = useCallback(
    async (branch: string) => {
      if (!onMergeBranch) return
      const result = await onMergeBranch(branch)
      if (result.success) {
        onToast(t('workbench.git_merge_success', '分支已合并'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onMergeBranch, onToast, t, handleRefreshStatus]
  )

  const handleDeleteBranch = useCallback(
    async (branch: string, force = false) => {
      if (!onDeleteBranch) return
      const result = await onDeleteBranch(branch, force)
      if (result.success) {
        onToast(t('workbench.git_branch_deleted', '分支已删除'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onDeleteBranch, onToast, t, handleRefreshStatus]
  )

  const handlePublishBranch = useCallback(
    async (branch?: string) => {
      if (!onPublishBranch) return
      const result = await onPublishBranch(branch)
      if (result.success) {
        onToast(t('workbench.git_branch_published', '分支已发布到远程'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onPublishBranch, onToast, t, handleRefreshStatus]
  )

  const handleStashPush = useCallback(
    async (message?: string) => {
      if (!onStashPush) return
      const result = await onStashPush(message)
      if (result.success) {
        onToast(t('workbench.git_stash_saved', '已贮藏变更'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onStashPush, onToast, t, handleRefreshStatus]
  )

  const handleStashApply = useCallback(
    async (index: number) => {
      if (!onStashApply) return
      const result = await onStashApply(index)
      if (result.success) {
        onToast(t('workbench.git_stash_applied', '已应用贮藏'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onStashApply, onToast, t, handleRefreshStatus]
  )

  const handleStashPop = useCallback(
    async (index: number) => {
      if (!onStashPop) return
      const result = await onStashPop(index)
      if (result.success) {
        onToast(t('workbench.git_stash_popped', '已弹出贮藏'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onStashPop, onToast, t, handleRefreshStatus]
  )

  const handleStashDrop = useCallback(
    async (index: number) => {
      if (!onStashDrop) return
      const result = await onStashDrop(index)
      if (result.success) {
        onToast(t('workbench.git_stash_dropped', '已删除贮藏'), 'success')
        await handleRefreshStatus()
      } else if (result.message) {
        onToast(result.message, 'error')
      }
    },
    [onStashDrop, onToast, t, handleRefreshStatus]
  )

  const handleRefreshAll = useCallback(async () => {
    await handleRefreshStatus()
    await handleLoadHistory()
    await handleLoadRecentPulls()
  }, [handleRefreshStatus, handleLoadHistory, handleLoadRecentPulls])

  const {
    handleSelectCommit,
    handleViewDiff,
    handleViewWorkingDiff,
    handleStageFile,
    handleStageAll,
    handleUnstageFile,
    handleUnstageAll,
    handleDiscardFile,
    handleDiscardAll,
    destructiveConfirm,
    isConfirmingDestructive,
    confirmDestructiveAction,
    cancelDestructiveAction,
    handleRollback,
    handleRollbackAll
  } = useGitManagementWorkspace({
    t,
    onToast,
    onGetCommitChanges,
    onGetFileDiff,
    onGetWorkingDiff,
    onStageFile,
    onStageAll,
    onUnstageFile,
    onUnstageAll,
    onDiscardFile,
    onDiscardAllChanges,
    onRollbackFile,
    onRollbackAll,
    onGetRollbackAllContext,
    expandedCommit,
    setExpandedCommit,
    setSelectedCommit,
    setCommitChanges,
    setSelectedFileDiff,
    selectedCommit,
    expandedFile,
    setExpandedFile,
    expandedWorkingFile,
    setExpandedWorkingFile,
    setWorkingFileDiff,
    handleRefreshStatus,
    handleLoadHistory,
    onOpenDiffInEditor,
    onOpenCommitDiffInEditor
  })

  return {
    t,
    isInitialized,
    onResolveConflict,
    tab,
    setTab,
    remoteUrl,
    setRemoteUrl,
    remoteBranch,
    setRemoteBranch,
    remoteUsername,
    setRemoteUsername,
    remoteToken,
    setRemoteToken,
    userName,
    setUserName,
    userEmail,
    setUserEmail,
    showPassword,
    setShowPassword,
    gitStatus,
    expandedSections,
    history,
    recentPulls,
    selectedCommit,
    commitChanges,
    selectedFileDiff,
    conflicts,
    expandedCommit,
    expandedFile,
    expandedWorkingFile,
    workingFileDiff,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    commitMessage,
    setCommitMessage,
    stagedCount,
    unstagedCount,
    canCommit,
    canCommitStaged,
    branchInfo,
    stashList,
    toggleSection,
    handleRefreshStatus,
    handleRefreshAll,
    handleLoadHistory,
    handleLoadRecentPulls,
    handleInit,
    handleSaveAuthorConfig,
    handleSaveRemoteConfig,
    handleTestRemote,
    handlePush,
    handlePull,
    handleManualCommit,
    handleCommitAll,
    handleCommitAndPush,
    handleSelectCommit,
    handleViewDiff,
    handleViewWorkingDiff,
    handleStageFile,
    handleStageAll,
    handleUnstageFile,
    handleUnstageAll,
    handleDiscardFile,
    handleDiscardAll,
    destructiveConfirm,
    isConfirmingDestructive,
    confirmDestructiveAction,
    cancelDestructiveAction,
    handleRollback,
    handleRollbackAll,
    handleCheckoutBranch,
    handleCreateBranch,
    handleSetRemoteUrl,
    handleMergeBranch,
    handleDeleteBranch,
    handlePublishBranch,
    handleLoadStash,
    handleStashPush,
    handleStashApply,
    handleStashPop,
    handleStashDrop
  }
}

export type GitManagementViewModel = ReturnType<typeof useGitManagementPage>
