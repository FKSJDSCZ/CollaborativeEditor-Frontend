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
// import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import * as Y from 'yjs';
// import {WebsocketProvider} from 'y-websocket';
import {SocketIOProvider} from "@/lib/y-socket.io";
import {QuillBinding} from 'y-quill';
import {v4 as uuidv4} from 'uuid';
import FluentEditor from "@opentiny/fluent-editor";

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
		const username = ref('User' + Math.floor(Math.random() * 1000));
		const userId = ref(uuidv4());

		// 存储引用
		let fluentEditor = null;
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
						['undo', 'redo', 'clean', 'format-painter'],
						[
							// 请保留默认值为 false
							{header: [1, 2, 3, 4, 5, 6, false]},
							{font: [false, '仿宋_GB2312, 仿宋', '楷体', '隶书', '黑体', '无效字体, 隶书']},
							{size: [false, '12px', '14px', '16px', '18px', '20px', '24px', '32px', '36px', '48px', '72px']},
							{'line-height': [false, '1.2', '1.5', '1.75', '2', '3', '4', '5']},
						],
						['bold', 'italic', 'strike', 'underline', 'divider'],
						[{color: []}, {background: []}],
						[{align: ''}, {align: 'center'}, {align: 'right'}, {align: 'justify'}],
						[{list: 'ordered'}, {list: 'bullet'}, {list: 'check'}],
						[{script: 'sub'}, {script: 'super'}],
						[{indent: '-1'}, {indent: '+1'}],
						[{direction: 'rtl'}],
						['link', 'blockquote', 'code', 'code-block'],
						['image', 'file'],
						['emoji', 'video', 'formula', 'screenshot', 'fullscreen'],
						[{'table-up': []}],
					]
				}
			};

			fluentEditor = new FluentEditor('#editor', quillOptions);

			// 初始化 YJS
			yDoc = new Y.Doc();

			// 初始化 WebSocket Provider
			const websocketUrl = `ws://${process.env.VUE_APP_BACKEND_HOST || 'localhost'}:${process.env.VUE_APP_BACKEND_PORT || '8080'}`;
			provider = new SocketIOProvider(websocketUrl, props.docId, yDoc, {
				autoConnect: true,
				auth: {
					access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0ODQ4MzY2NywianRpIjoiYjA5ODQxOTItNmQ3Mi00NzNjLTlhMmYtMDg1NTcyMmUzNjRiIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjEiLCJuYmYiOjE3NDg0ODM2NjcsImNzcmYiOiJhNDNkNTljMy0yNDAyLTRmZGMtODViNi1iYzRiMjFiNjcwZTQiLCJleHAiOjE3NDg0ODcyNjd9.WEWhSiAbarT2wtNu1GdxGpuzvdZNn71agunPDmyBqxo'
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
					if (state.user && clientId !== provider.doc.clientID) {
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
			binding = new QuillBinding(yText, fluentEditor, provider.awareness);

			// 连接错误处理
			provider.on('connection-error', (error) => {
				console.error('Connection error:', error);
			});

			provider.on('connection-close', (event) => {
				console.log('Connection closed:', event);
			});
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