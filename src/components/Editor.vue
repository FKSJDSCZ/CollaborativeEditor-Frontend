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

		<div id="editor"></div>

		<div class="collaborators">
			<div v-for="(user, id) in activeUsers" :key="id" class="user-cursor">
				<div v-if="id !== userId">
					<span class="user-color" :style="{ backgroundColor: user.color }"></span>
					{{ user.name }}
					<span v-if="user.cursor" class="cursor-info">(活跃)</span>
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
import {SocketIOProvider} from "@/lib/y-socket.io";
import {QuillBinding} from 'y-quill';
import {v4 as uuidv4} from 'uuid';
import FluentEditor from "@opentiny/fluent-editor";
import QuillCursors from 'quill-cursors';

// 注册 cursors 模块
FluentEditor.register('modules/cursors', QuillCursors);

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
		const userColor = ref('#' + Math.floor(Math.random() * 16777215).toString(16));

		// 存储引用
		let fluentEditor = null;
		let cursorsModule = null;
		let yDoc = null;
		let provider = null;
		let binding = null;

		// 创建协同编辑器
		const setupCollaborativeEditor = () => {
			// 初始化 Quill 编辑器，添加 cursors 模块
			const quillOptions = {
				theme: 'snow',
				modules: {
					cursors: {
						hideDelayMs: 5000,
						hideSpeedMs: 500,
						// selectionChangeSource: null,
						// transformOnTextChange: true
					},
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
			cursorsModule = fluentEditor.getModule('cursors');

			// 初始化 YJS
			yDoc = new Y.Doc();

			// 初始化 WebSocket Provider
			const websocketUrl = `ws://${process.env.VUE_APP_BACKEND_HOST || 'localhost'}:${process.env.VUE_APP_BACKEND_PORT || '8080'}`;
			provider = new SocketIOProvider(websocketUrl, props.docId, yDoc, {
				autoConnect: true,
				auth: {
					access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0ODY3MzUxMywianRpIjoiYmRhM2M4MjgtNzhjZS00NTFmLWIyZmEtYjljNTY5ZGRmOTc1IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjEiLCJuYmYiOjE3NDg2NzM1MTMsImNzcmYiOiJlN2JlZjg3ZS1kOTVhLTRhMjItYTZkYS0zMDIzYmQwMDdkZGQiLCJleHAiOjE3NDg3MTY3MTN9.WTmtT4yrKN7eo7kov6O1fwap6KooD5eEWcyGv5rjFHQ'
				}
			});

			// 设置状态监听
			provider.on('status', (event) => {
				isConnected.value = event.status === 'connected';
			});

			// 监听协作者加入和光标变化
			provider.awareness.on('change', () => {
				const states = provider.awareness.getStates();
				const users = {};

				console.log("on change", states);
				states.forEach((state, clientId) => {
					if (state.user && clientId !== provider.doc.clientID) {
						users[clientId] = {
							name: state.user.name,
							color: state.user.color,
							cursor: state.cursor
						};

						// 更新或创建光标
						if (state.cursor) {
							const cursorId = `${clientId}`;

							console.log("other cursors", cursorsModule._cursors)
							// 检查光标是否已存在
							let cursor = cursorsModule.cursors().find(c => c.id === cursorId);
							if (!cursor) {
								cursor = cursorsModule.createCursor(cursorId, state.user.name, state.user.color);
								console.log("create cursor for", cursorId)
							}

							// 更新光标位置
							cursorsModule.moveCursor(cursorId, cursor.range);
							console.log("update cursor", cursorId)
						}
					}
				});

				activeUsers.value = users;
			});

			// 设置自己的用户信息
			provider.awareness.setLocalStateField('user', {
				name: username.value,
				color: userColor.value
			});

			// 初始化 Quill Binding
			const yText = yDoc.getText('quill');
			binding = new QuillBinding(yText, fluentEditor, provider.awareness);

			// 监听光标选择变化
			fluentEditor.on('selection-change', (range, oldRange, source) => {
				console.log("selection changed", range, oldRange, source);
				if (source === 'user') {
					// 用户手动改变选择，立即发送
					if (range) {
						const sel = fluentEditor.getSelection()
						provider.awareness.setLocalStateField('cursor', {
							anchor: Y.createRelativePositionFromTypeIndex(yText, sel.index),
							head: Y.createRelativePositionFromTypeIndex(yText, sel.index + sel.length)
						});
					} else {
						provider.awareness.setLocalStateField('cursor', null);
					}
				}
			});

			// 处理文本变化时的光标变换
			// fluentEditor.on('text-change', (delta, oldDelta, source) => {
			// 	console.log("text changed", delta, oldDelta, source);
			// 	if (source === 'user') {
			// 		// 当用户进行文本编辑时，更新光标位置信息
			// 		if (delta) {
			// 			const sel = fluentEditor.getSelection()
			// 			provider.awareness.setLocalStateField('cursor', {
			// 				anchor: Y.createRelativePositionFromTypeIndex(yText, sel.index),
			// 				head: Y.createRelativePositionFromTypeIndex(yText, sel.index + sel.length)
			// 			});
			// 		}
			// 	}
			// });

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
@import "@opentiny/fluent-editor/style.css";

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

.connection-status {
	padding: 4px 8px;
	border-radius: 4px;
	background-color: #dc3545;
	color: white;
	font-size: 12px;
}

.connection-status.connected {
	background-color: #28a745;
}

.collaborators {
	padding: 8px;
	background-color: #f8f9fa;
	border-top: 1px solid #ccc;
	min-height: 40px;
}

.user-cursor {
	display: inline-block;
	margin-right: 10px;
	padding: 4px 8px;
	border-radius: 12px;
	font-size: 12px;
	background-color: #f0f0f0;
	color: #333;
	border: 1px solid #ddd;
}

.user-color {
	display: inline-block;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	margin-right: 6px;
	vertical-align: middle;
}

.cursor-info {
	font-size: 10px;
	color: #666;
	margin-left: 4px;
}
</style>