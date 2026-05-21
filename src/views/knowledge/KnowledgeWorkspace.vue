<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, FolderOpened, UploadFilled } from '@element-plus/icons-vue'
import { pageScenicAreasApi } from '@/api/map'
import { trainKnowledgeApi, uploadKnowledgeFilesApi } from '@/api/knowledge'
import { pinia, useUserStore } from '@/stores'

const userStore = useUserStore(pinia)

const selectedScenicAreaId = ref('')
const selectedFiles = ref([])
const scenicOptions = ref([])
const uploadResult = ref(null)
const trainResult = ref(null)

const loading = reactive({
  scenic: false,
  upload: false,
  train: false,
})

const canOperate = computed(() => userStore.isSuperAdmin)
const savedFiles = computed(() => uploadResult.value?.saved_files || [])
const rejectedFiles = computed(() => uploadResult.value?.rejected_files || [])
const totalFileSize = computed(() => selectedFiles.value.reduce((sum, file) => sum + file.size, 0))

const scenicSelectOptions = computed(() => [
  { label: '全局知识库', value: '' },
  ...scenicOptions.value.map((item) => ({
    label: item.scenicName || `景区 #${item.id}`,
    value: item.id,
  })),
])

function formatFileSize(size) {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function isAllowedFile(file) {
  const suffix = String(file.name || '').split('.').pop()?.toLowerCase()
  return ['txt', 'pdf'].includes(suffix)
}

function handleFileChange(file, fileList) {
  const validFiles = fileList.map((item) => item.raw).filter(Boolean)
  selectedFiles.value = validFiles

  if (file?.raw && !isAllowedFile(file.raw)) {
    ElMessage.warning('前端仅提示 txt、pdf，最终允许类型以后端和 Agent 返回为准')
  }
}

function handleFileRemove(file, fileList) {
  selectedFiles.value = fileList.map((item) => item.raw).filter(Boolean)
}

async function fetchScenicOptions() {
  loading.scenic = true
  try {
    const result = await pageScenicAreasApi({ pageNum: 1, pageSize: 200, status: 1 })
    scenicOptions.value = result?.records || result?.list || []
  } finally {
    loading.scenic = false
  }
}

async function handleUpload() {
  if (!canOperate.value) {
    ElMessage.error('仅超级管理员可操作')
    return
  }

  if (!selectedFiles.value.length) {
    ElMessage.warning('请先选择知识库文档')
    return
  }

  loading.upload = true
  uploadResult.value = null
  try {
    const result = await uploadKnowledgeFilesApi(selectedFiles.value, selectedScenicAreaId.value)
    uploadResult.value = {
      saved_files: [],
      rejected_files: [],
      ...result,
    }
    ElMessage.success(result?.message || '知识库文档上传成功')
  } finally {
    loading.upload = false
  }
}

async function handleTrain() {
  if (!canOperate.value) {
    ElMessage.error('仅超级管理员可操作')
    return
  }

  loading.train = true
  trainResult.value = null
  try {
    const result = await trainKnowledgeApi()
    trainResult.value = result
    ElMessage.success(result?.message || '知识库训练完成')
  } finally {
    loading.train = false
  }
}

onMounted(() => {
  fetchScenicOptions()
})
</script>

<template>
  <div class="knowledge-workspace">
    <el-alert
      v-if="!canOperate"
      type="warning"
      title="仅超级管理员可操作知识库上传和训练"
      show-icon
      :closable="false"
    />

    <section class="knowledge-panel">
      <div class="knowledge-panel__head">
        <div>
          <p class="knowledge-eyebrow">Knowledge Base</p>
          <h3>知识库文档上传</h3>
        </div>
        <el-tag effect="plain" type="success">支持 txt / pdf</el-tag>
      </div>

      <el-form label-position="top" class="knowledge-form">
        <el-form-item label="关联景区">
          <el-select
            v-model="selectedScenicAreaId"
            :loading="loading.scenic"
            filterable
            placeholder="请选择关联景区"
          >
            <el-option
              v-for="item in scenicSelectOptions"
              :key="item.value === '' ? 'global' : item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择文档">
          <el-upload
            drag
            multiple
            action="#"
            accept=".txt,.pdf"
            :auto-upload="false"
            :disabled="!canOperate || loading.upload"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
          >
            <el-icon class="knowledge-upload__icon"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖拽文件到此处，或点击选择文件</div>
            <template #tip>
              <div class="knowledge-upload__tip">多文件上传使用同一个 files 字段，实际允许类型以后端配置为准。</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>

      <div class="knowledge-summary">
        <div>
          <span>待上传文件</span>
          <strong>{{ selectedFiles.length }}</strong>
        </div>
        <div>
          <span>文件总大小</span>
          <strong>{{ formatFileSize(totalFileSize) }}</strong>
        </div>
        <div>
          <span>知识范围</span>
          <strong>{{ selectedScenicAreaId ? '景区知识库' : '全局知识库' }}</strong>
        </div>
      </div>

      <div v-if="selectedFiles.length" class="knowledge-file-list">
        <div v-for="file in selectedFiles" :key="`${file.name}-${file.size}`" class="knowledge-file">
          <el-icon><Document /></el-icon>
          <span>{{ file.name }}</span>
          <small>{{ formatFileSize(file.size) }}</small>
        </div>
      </div>

      <div class="knowledge-actions">
        <el-button
          type="primary"
          :disabled="!canOperate || !selectedFiles.length"
          :loading="loading.upload"
          @click="handleUpload"
        >
          上传文档
        </el-button>
      </div>
    </section>

    <section class="knowledge-panel">
      <div class="knowledge-panel__head">
        <div>
          <p class="knowledge-eyebrow">Vector Training</p>
          <h3>训练知识库</h3>
        </div>
        <el-icon class="knowledge-panel__icon"><FolderOpened /></el-icon>
      </div>

      <p class="knowledge-copy">
        上传完成后触发训练，后端会调用 Agent 处理知识库目录并写入向量库；训练期间请避免重复点击。
      </p>

      <div class="knowledge-actions">
        <el-button type="success" :disabled="!canOperate" :loading="loading.train" @click="handleTrain">
          开始训练
        </el-button>
      </div>
    </section>

    <section v-if="uploadResult || trainResult" class="knowledge-panel knowledge-panel--result">
      <div class="knowledge-panel__head">
        <div>
          <p class="knowledge-eyebrow">Result</p>
          <h3>执行结果</h3>
        </div>
      </div>

      <div v-if="uploadResult" class="knowledge-result">
        <strong>{{ uploadResult.message || '上传完成' }}</strong>
        <div class="knowledge-result__columns">
          <div>
            <span>已保存文件</span>
            <el-empty v-if="!savedFiles.length" description="暂无" :image-size="56" />
            <el-tag v-for="file in savedFiles" v-else :key="file" type="success" effect="plain">{{ file }}</el-tag>
          </div>
          <div>
            <span>被拒绝文件</span>
            <el-empty v-if="!rejectedFiles.length" description="暂无" :image-size="56" />
            <el-tag v-for="file in rejectedFiles" v-else :key="file" type="danger" effect="plain">{{ file }}</el-tag>
          </div>
        </div>
      </div>

      <div v-if="trainResult" class="knowledge-result">
        <strong>{{ trainResult.message || '训练完成' }}</strong>
      </div>
    </section>
  </div>
</template>

<style scoped>
.knowledge-workspace {
  display: grid;
  gap: 16px;
}

.knowledge-panel {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.knowledge-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.knowledge-panel__head h3 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.3;
}

.knowledge-panel__icon {
  color: #0f8f7f;
  font-size: 28px;
}

.knowledge-eyebrow {
  margin: 0 0 4px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.knowledge-form {
  display: grid;
  gap: 4px;
}

.knowledge-upload__icon {
  color: #0f8f7f;
  font-size: 42px;
}

.knowledge-upload__tip {
  color: #64748b;
  font-size: 13px;
}

.knowledge-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.knowledge-summary > div {
  display: grid;
  gap: 5px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f8fafc;
}

.knowledge-summary span,
.knowledge-result span {
  color: #64748b;
  font-size: 13px;
}

.knowledge-summary strong {
  color: #0f172a;
  font-size: 18px;
}

.knowledge-file-list,
.knowledge-result__columns {
  display: grid;
  gap: 10px;
}

.knowledge-file {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.knowledge-file span {
  overflow: hidden;
  color: #0f172a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-file small {
  color: #64748b;
}

.knowledge-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.knowledge-copy {
  margin: 0;
  color: #475569;
  line-height: 1.8;
}

.knowledge-panel--result {
  background: #fbfefc;
}

.knowledge-result {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;
  background: #f8fafc;
}

.knowledge-result strong {
  color: #0f172a;
}

.knowledge-result__columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.knowledge-result__columns > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
  min-height: 88px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.knowledge-result__columns span {
  flex: 0 0 100%;
}

@media (max-width: 768px) {
  .knowledge-summary,
  .knowledge-result__columns {
    grid-template-columns: 1fr;
  }

  .knowledge-panel__head,
  .knowledge-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
