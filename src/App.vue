<template>
	<div class="app-container">
		<header>
			<h1>实时协同编辑演示</h1>
		</header>

		<main>
			<DocumentEditor :docId="documentId"/>
		</main>

		<footer>
			<p>协同编辑系统演示 - {{ new Date().getFullYear() }}</p>
		</footer>
	</div>
</template>

<script>
import {ref} from 'vue';
import DocumentEditor from "./components/Editor.vue";

export default {
	name: 'App',
	components: {
		DocumentEditor,
	},
	setup() {
		// 可以通过URL参数或其他方式获取文档ID
		const documentId = ref('1');

		return {
			documentId
		};
	}
};
</script>

<style>
body {
	margin: 0;
	padding: 0;
	font-family: Arial, sans-serif;
}

.app-container {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
}

header {
	background-color: #4a69bd;
	color: white;
	padding: 1rem;
	text-align: center;
}

main {
	flex: 1;
	padding: 1rem;
	max-width: 1200px;
	margin: 0 auto;
	width: 100%;
}

footer {
	background-color: #f1f2f6;
	padding: 1rem;
	text-align: center;
	color: #57606f;
}
</style>