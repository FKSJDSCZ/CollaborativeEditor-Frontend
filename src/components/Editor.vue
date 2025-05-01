<template>
	<div class="editor-container">
		<div class="toolbar">
			<span class="user-info">
				{{ username }}
			</span>
			<span class="connection-status" :class="{ 'connected': isConnected }">
				{{ isConnected ? '已连接' : '未连接' }}
			</span>
		</div>

		<div class="editor-wrapper">
			<div id="editor"></div>
		</div>

		<div class="collaborators">
			<div v-for="(user, id) in activeUsers" :key="id" class="user-cursor">
				<div v-if="id !== userId">
					{{ user.name }}
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import {onMounted, onUnmounted, ref} from 'vue';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {QuillBinding} from 'y-quill';
import {v4 as uuidv4} from 'uuid';

export default {
	name: 'DocumentEditor',
	props: {
		docId: {
			type: String,
			default: 'default-doc'
		}
	},
	setup(props) {
		// 状态变量
		const isConnected = ref(false);
		const activeUsers = ref({});
		const username = ref('用户' + Math.floor(Math.random() * 1000));
		const userId = ref(uuidv4());

		// 存储引用
		let quillEditor = null;
		let yDoc = null;
		let provider = null;
		let binding = null;

		// 创建协同编辑器
		const setupCollaborativeEditor = () => {
			// 初始化 Quill 编辑器
			const quillOptions = {
				theme: 'snow',
				modules: {
					toolbar: [
						['bold', 'italic', 'underline', 'strike'],
						['blockquote', 'code-block'],
						[{'header': 1}, {'header': 2}],
						[{'list': 'ordered'}, {'list': 'bullet'}],
						[{'script': 'sub'}, {'script': 'super'}],
						[{'indent': '-1'}, {'indent': '+1'}],
						[{'direction': 'rtl'}],
						[{'size': ['small', false, 'large', 'huge']}],
						[{'header': [1, 2, 3, 4, 5, 6, false]}],
						[{'color': []}, {'background': []}],
						[{'font': []}],
						[{'align': []}],
						['clean'],
						['image', 'table']
					]
				}
			};

			quillEditor = new Quill('#editor', quillOptions);

			// 初始化 YJS
			yDoc = new Y.Doc();

			// 初始化 WebSocket Provider
			const websocketUrl = `ws://${process.env.VUE_APP_BACKEND_HOST || 'localhost'}:${process.env.VUE_APP_BACKEND_PORT || '8080'}/ws`;
			provider = new WebsocketProvider(websocketUrl, props.docId, yDoc, {
				params: {
					userId: userId.value,
					username: username.value
				}
			});

			// 设置状态监听
			provider.on('status', (event) => {
				isConnected.value = event.status === 'connected';
			});

			// 监听协作者数据
			provider.awareness.on('change', () => {
				const states = provider.awareness.getStates();
				const users = {};

				states.forEach((state, clientId) => {
					if (state.user) {
						users[clientId] = {
							name: state.user.name,
							color: state.user.color
						};
					}
				});

				activeUsers.value = users;
			});

			// 设置自己的用户信息
			provider.awareness.setLocalStateField('user', {
				name: username.value,
				color: '#' + Math.floor(Math.random() * 16777215).toString(16)
			});

			// 初始化 Quill Binding
			const yText = yDoc.getText('quill');
			binding = new QuillBinding(yText, quillEditor, provider.awareness);
		};

		// 生命周期钩子
		onMounted(() => {
			setupCollaborativeEditor();
		});

		onUnmounted(() => {
			if (provider) {
				provider.disconnect();
			}

			if (binding) {
				binding.destroy();
			}
		});

		return {
			isConnected,
			activeUsers,
			username,
			userId
		};
	}
};
</script>

<style scoped>
.editor-container {
	display: flex;
	flex-direction: column;
	height: 100%;
	border: 1px solid #ccc;
	border-radius: 4px;
}

.toolbar {
	display: flex;
	justify-content: space-between;
	padding: 8px;
	background-color: #f8f9fa;
	border-bottom: 1px solid #ccc;
}

.editor-wrapper {
	flex-grow: 1;
	overflow-y: auto;
	padding: 10px;
}

.connection-status {
	padding: 4px 8px;
	border-radius: 4px;
	background-color: #dc3545;
	color: white;
}

.connection-status.connected {
	background-color: #28a745;
}

.collaborators {
	padding: 8px;
	background-color: #f8f9fa;
	border-top: 1px solid #ccc;
}

.user-cursor {
	display: inline-block;
	margin-right: 10px;
	padding: 2px 6px;
	border-radius: 4px;
	font-size: 12px;
	background-color: #007bff;
	color: white;
}
</style>