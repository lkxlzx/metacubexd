import {
  IconArrowDown,
  IconArrowUp,
  IconEyeOff,
} from '@tabler/icons-solidjs'
import byteSize from 'byte-size'
import { For } from 'solid-js'
import { useI18n } from '~/i18n'
import {
  proxyNodeTrafficMap,
  ProxyNodeTrafficEntry,
  useProxies,
} from '~/signals'

type SortField = 'name' | 'connections' | 'total'
type SortOrder = 'asc' | 'desc'

export const ProxyNodeTrafficTable = () => {
  const [t] = useI18n()
  const [sortField, setSortField] = createSignal<SortField>('total')
  const [sortOrder, setSortOrder] = createSignal<SortOrder>('desc')
  const [hideRules, setHideRules] = createSignal(false)
  const { proxyNodeMap, fetchProxies } = useProxies()

  // 加载代理数据
  onMount(() => {
    fetchProxies()
  })

  const handleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const trafficEntries = createMemo(() => {
    const rawEntries = Object.values(proxyNodeTrafficMap())
    const nodeMap = proxyNodeMap()

    // 增强数据：添加类型信息
    const entries: ProxyNodeTrafficEntry[] = rawEntries
      .map((entry): ProxyNodeTrafficEntry => {
        const nodeInfo = nodeMap[entry.nodeName]

        // 如果节点不存在于 proxyNodeMap 中，标记为 Unknown（可能是规则）
        if (!nodeInfo) {
          return {
            ...entry,
            type: 'Unknown',
          }
        }

        // 使用节点的实际类型
        return {
          ...entry,
          type: nodeInfo.type,
        }
      })
      .filter((entry) => {
        // 如果启用了"隐藏规则"，过滤掉 Unknown 类型（规则）和 URLTest 类型
        if (hideRules()) {
          const nodeType = entry.type.toLowerCase()
          if (entry.type === 'Unknown' || nodeType === 'urltest') {
            return false
          }
        }
        return true
      })

    const field = sortField()
    const order = sortOrder()

    return entries.sort((a, b) => {
      let comparison = 0

      switch (field) {
        case 'name':
          comparison = a.nodeName.localeCompare(b.nodeName)
          break
        case 'connections':
          comparison = a.connectionCount - b.connectionCount
          break
        case 'total':
          comparison = a.total - b.total
          break
      }

      return order === 'asc' ? comparison : -comparison
    })
  })

  const totalStats = createMemo(() => {
    const entries = trafficEntries()
    const totalUpload = entries.reduce(
      (sum: number, entry: ProxyNodeTrafficEntry) => sum + entry.upload,
      0,
    )
    const totalDownload = entries.reduce(
      (sum: number, entry: ProxyNodeTrafficEntry) => sum + entry.download,
      0,
    )
    const totalConnections = entries.reduce(
      (sum: number, entry: ProxyNodeTrafficEntry) =>
        sum + entry.connectionCount,
      0,
    )

    return {
      count: entries.length,
      upload: totalUpload,
      download: totalDownload,
      total: totalUpload + totalDownload,
      connections: totalConnections,
    }
  })

  const SortButton = (props: { field: SortField; label: string }) => {
    const isActive = () => sortField() === props.field
    const currentOrder = () => (isActive() ? sortOrder() : null)

    return (
      <button
        class="flex items-center gap-1 hover:text-primary"
        onClick={() => handleSort(props.field)}
      >
        <span>{props.label}</span>
        <Show when={isActive()}>
          {currentOrder() === 'asc' ? (
            <IconArrowUp size={14} />
          ) : (
            <IconArrowDown size={14} />
          )}
        </Show>
      </button>
    )
  }

  return (
    <div class="rounded-box bg-base-300 p-4">
      <div class="mb-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-base-content">
            {t('proxyNodeTraffic')}
          </h2>
          <button
            class="btn btn-sm btn-primary"
            onClick={() => setHideRules(!hideRules())}
          >
            <IconEyeOff size={16} />
            <span class="hidden sm:inline">
              {hideRules() ? t('showRules') : t('hideRules')}
            </span>
          </button>
        </div>
        <Show when={totalStats().count > 0}>
          <div class="stats stats-vertical bg-base-200 shadow sm:stats-horizontal">
            <div class="stat py-2">
              <div class="stat-title text-xs">{t('proxyNodes')}</div>
              <div class="stat-value text-lg text-primary">
                {totalStats().count}
              </div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">{t('totalConnections')}</div>
              <div class="stat-value text-lg">
                {totalStats().connections}
              </div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">{t('uploadTotal')}</div>
              <div class="stat-value text-lg">
                {byteSize(totalStats().upload).toString()}
              </div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">{t('downloadTotal')}</div>
              <div class="stat-value text-lg">
                {byteSize(totalStats().download).toString()}
              </div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">{t('grandTotal')}</div>
              <div class="stat-value text-lg text-secondary">
                {byteSize(totalStats().total).toString()}
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Desktop Table View */}
      <div class="hidden overflow-x-auto rounded-md lg:block">
        <table class="table w-full table-zebra">
          <thead>
            <tr class="bg-base-200">
              <th class="text-base-content">
                <SortButton field="name" label={t('proxyNodeName')} />
              </th>
              <th class="text-base-content">{t('type')}</th>
              <th class="text-base-content">
                <SortButton field="connections" label={t('connections')} />
              </th>
              <th class="text-base-content">{t('upload')}</th>
              <th class="text-base-content">{t('download')}</th>
              <th class="text-base-content">
                <SortButton field="total" label={t('total')} />
              </th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={trafficEntries().length > 0}
              fallback={
                <tr>
                  <td colSpan={6} class="text-center text-base-content/70">
                    {t('noProxyNodeTrafficYet')}
                  </td>
                </tr>
              }
            >
              <For each={trafficEntries()}>
                {(entry: ProxyNodeTrafficEntry) => (
                  <tr class="hover">
                    <td class="font-medium text-base-content">
                      {entry.nodeName}
                    </td>
                    <td class="text-base-content">
                      <span class="badge badge-sm badge-outline">
                        {entry.type}
                      </span>
                    </td>
                    <td class="text-base-content">{entry.connectionCount}</td>
                    <td class="text-base-content">
                      {byteSize(entry.upload).toString()}
                    </td>
                    <td class="text-base-content">
                      {byteSize(entry.download).toString()}
                    </td>
                    <td class="font-bold text-primary">
                      {byteSize(entry.total).toString()}
                    </td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div class="flex flex-col gap-3 lg:hidden">
        <Show when={trafficEntries().length > 0}>
          <div class="flex gap-2 rounded-lg bg-base-200 p-3">
            <div class="text-xs font-semibold text-base-content/60">
              {t('sortBy')}
            </div>
            <div class="flex flex-1 gap-2">
              <button
                class={`btn flex-1 btn-xs ${sortField() === 'name' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSort('name')}
              >
                {t('name')}
                <Show when={sortField() === 'name'}>
                  {sortOrder() === 'asc' ? (
                    <IconArrowUp size={12} />
                  ) : (
                    <IconArrowDown size={12} />
                  )}
                </Show>
              </button>
              <button
                class={`btn flex-1 btn-xs ${sortField() === 'connections' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSort('connections')}
              >
                {t('connections')}
                <Show when={sortField() === 'connections'}>
                  {sortOrder() === 'asc' ? (
                    <IconArrowUp size={12} />
                  ) : (
                    <IconArrowDown size={12} />
                  )}
                </Show>
              </button>
              <button
                class={`btn flex-1 btn-xs ${sortField() === 'total' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSort('total')}
              >
                {t('total')}
                <Show when={sortField() === 'total'}>
                  {sortOrder() === 'asc' ? (
                    <IconArrowUp size={12} />
                  ) : (
                    <IconArrowDown size={12} />
                  )}
                </Show>
              </button>
            </div>
          </div>
        </Show>

        <Show
          when={trafficEntries().length > 0}
          fallback={
            <div class="rounded-lg bg-base-200 p-4 text-center text-base-content/70">
              {t('noProxyNodeTrafficYet')}
            </div>
          }
        >
          <For each={trafficEntries()}>
            {(entry: ProxyNodeTrafficEntry) => (
              <div class="card bg-base-200 shadow-md">
                <div class="card-body p-4">
                  <div class="mb-2 flex items-start justify-between">
                    <div class="flex-1">
                      <div class="text-xs font-semibold text-base-content/60 uppercase">
                        {t('proxyNodeName')}
                      </div>
                      <div class="text-sm font-bold text-base-content">
                        {entry.nodeName}
                      </div>
                    </div>
                    <span class="badge badge-sm badge-outline">
                      {entry.type}
                    </span>
                  </div>

                  <div class="mb-2">
                    <div class="text-xs font-semibold text-base-content/60 uppercase">
                      {t('connections')}
                    </div>
                    <div class="text-sm text-base-content">
                      {entry.connectionCount}
                    </div>
                  </div>

                  <div class="divider my-2" />

                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <div class="text-xs font-semibold text-base-content/60 uppercase">
                        {t('upload')}
                      </div>
                      <div class="text-sm font-medium text-base-content">
                        {byteSize(entry.upload).toString()}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs font-semibold text-base-content/60 uppercase">
                        {t('download')}
                      </div>
                      <div class="text-sm font-medium text-base-content">
                        {byteSize(entry.download).toString()}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs font-semibold text-base-content/60 uppercase">
                        {t('total')}
                      </div>
                      <div class="text-sm font-bold text-primary">
                        {byteSize(entry.total).toString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
