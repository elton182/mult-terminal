# multerm

Gerenciador de múltiplos terminais para Windows, Linux e macOS. Construído com **Tauri 2** (Rust) + **Vue 3** + **xterm.js**.

## Funcionalidades

- **Terminais locais** — CMD, PowerShell, WSL, Bash, Zsh, Fish
- **SSH integrado** — conexão por senha ou chave privada, perfis salvos
- **Layout em grade flexível** — colunas com linhas variáveis (ex: 2+3+1 = 6 terminais simultâneos)
- **Redimensionamento de painéis** — arraste os divisores entre terminais
- **Atalhos de teclado** — navegação e controle sem mouse
- **Tema dark** inspirado no GitHub Dark
- **Ícone nativo** e integração com o Windows (auto-start, atalho no desktop)

## Instalação e execução

### Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- [Rust (via rustup)](https://rustup.rs)
- Windows: Microsoft C++ Build Tools + WebView2 (já incluso no Windows 10/11)
- Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev`

### Desenvolvimento

```bash
git clone <repo>
cd multerm
npm install
npm run tauri dev
```

### Build de produção

```bash
npm run tauri build
# Gera instalador em: src-tauri/target/release/bundle/
```

## Atalhos de teclado

| Tecla | Ação |
|-------|------|
| `Ctrl+T` | Novo terminal (modal de seleção) |
| `Ctrl+W` | Fechar terminal ativo |
| `Ctrl+Tab` | Próximo terminal |
| `Ctrl+Shift+Tab` | Terminal anterior |
| `Ctrl+Alt+1` | Layout: 1 coluna |
| `Ctrl+Alt+2` | Layout: 2 colunas (1+1) |
| `Ctrl+Alt+3` | Layout: coluna com 2 + coluna com 1 |
| `Ctrl+Alt+4` | Layout: coluna com 1 + coluna com 2 |
| `Ctrl+Alt+5` | Layout: **2+3+1** (6 terminais) |
| `Ctrl+Alt+6` | Layout: 3+3 (6 terminais) |
| `Ctrl+,` | Configurações |

## Layouts disponíveis

```
[1]       [1,1]     [2,1]     [1,2]
┌───┐     ┌──┬──┐   ┌──┬──┐   ┌──┬──┐
│   │     │  │  │   │  │  │   │  │  │
│   │     │  │  │   ├──┤  │   │  ├──┤
└───┘     └──┴──┘   │  │  │   │  │  │
                    └──┴──┘   └──┴──┘

[2,3,1]              [3,3]
┌──┬──┬──┐           ┌──┬──┐
│  │  │  │           │  │  │
├──┤  └──┘           ├──┼──┤
│  ├──┤              │  │  │
└──┤  │              ├──┼──┤
   └──┘              │  │  │
                     └──┴──┘
```

## Perfis SSH

1. Clique em **🔒** na toolbar
2. Clique em **+ Novo perfil**
3. Preencha host, porta, usuário e tipo de autenticação
4. Salve e clique em **▶** para conectar

Senhas não são persistidas em disco — são pedidas a cada conexão.

## Estrutura do projeto

```
multerm/
├── src/                    # Frontend Vue 3
│   ├── components/         # Componentes UI
│   ├── composables/        # Lógica reutilizável (xterm, teclado)
│   ├── stores/             # Estado global (Pinia)
│   └── types/              # TypeScript types
└── src-tauri/              # Backend Rust
    └── src/
        ├── pty/            # Gerenciador de processos PTY
        ├── ssh/            # Cliente SSH (russh)
        └── config/         # Modelos de configuração
```

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| App shell | Tauri 2 |
| Backend | Rust — `portable-pty`, `russh` |
| Frontend | Vue 3 + Vite + TypeScript |
| Terminal UI | xterm.js |
| Layout | splitpanes |
| Estado | Pinia |
| Persistência | tauri-plugin-store |

## Licença

MIT
