import {
  Module,
  VuexModule,
  Mutation,
  Action,
  getModule
} from 'vuex-module-decorators'
import { Vue } from 'vue-property-decorator'
import store from '@/store/store'
import { Position, Block, BlockComponent } from '@/@types/piledit'
import { VuexMixin } from '@/mixin/vuex'
import { blockComponentsModule } from '@/store/Modules/BlockComponents'

export interface BlockStateIF {
  allBlocks: { [key: string]: Block };
  objectOfBlockAndComponent: { [key: string]: string };
}

@Module({ dynamic: true, store: store, name: 'Blocks', namespaced: true })
class Blocks extends VuexModule implements BlockStateIF {
  allBlocks: { [key: string]: Block } = {}
  objectOfBlockAndComponent: { [key: string]: string } = {}

  @Mutation
  public addBlock (block: Block) {
    Vue.set(this.allBlocks, block.blockUniqueKey, block)
  }

  @Mutation
  public removeBlock (blockUniqueKey: string) {
    Vue.delete(this.allBlocks, blockUniqueKey)
  }

  @Mutation
  public updateBlock (block: Block) {
    this.allBlocks[block.blockUniqueKey] = block
  }

  @Mutation
  public updateChildBlock (block: Block) {
    let blockInSearch = this.allBlocks[block.blockUniqueKey]
    while (blockInSearch.childBlockUniqueKey !== '') {
      const child = this.allBlocks[blockInSearch.childBlockUniqueKey]
      child.position = {
        x: blockInSearch.position.x,
        y: blockInSearch.position.y + VuexMixin.calcHeight(blockInSearch.blockType)
      }
      blockInSearch = this.allBlocks[blockInSearch.childBlockUniqueKey]
    }
  }

  @Mutation
  public addChild (payload: { blockUniqueKey: string; childBlockUniqueKey: string }) {
    const blockUniqueKey = payload.blockUniqueKey
    const childBlockUniqueKey = payload.childBlockUniqueKey
    this.allBlocks[blockUniqueKey].childBlockUniqueKey = childBlockUniqueKey
    this.allBlocks[childBlockUniqueKey].parentBlockUniqueKey = blockUniqueKey
    if (this.allBlocks[blockUniqueKey].topBlockUniqueKey === '') {
      this.allBlocks[childBlockUniqueKey].topBlockUniqueKey = blockUniqueKey
    } else {
      this.allBlocks[childBlockUniqueKey].topBlockUniqueKey = this.allBlocks[blockUniqueKey].topBlockUniqueKey
    }
  }

  @Mutation
  public removeChild (blockUniqueKey: string) {
    const childBlockUniqueKey = this.allBlocks[blockUniqueKey].childBlockUniqueKey
    this.allBlocks[blockUniqueKey].childBlockUniqueKey = ''
    this.allBlocks[childBlockUniqueKey].parentBlockUniqueKey = ''
    this.allBlocks[blockUniqueKey].topBlockUniqueKey = ''
  }

  @Mutation
  public showShadow (blockUniqueKey: string) {
    this.allBlocks[blockUniqueKey].showShadow = true
  }

  @Mutation
  public hideShadow (blockUniqueKey: string) {
    this.allBlocks[blockUniqueKey].showShadow = false
  }

  @Mutation
  public addRelationBlockAndComponent (blockUniqueKey: string, componentUniqueKey: string) {
    Vue.set(this.objectOfBlockAndComponent, blockUniqueKey, componentUniqueKey)
  }

  @Mutation
  public removeRelationBlockAndComponent (blockUniqueKey: string) {
    Vue.delete(this.objectOfBlockAndComponent, blockUniqueKey)
  }

  @Action({ rawError: true })
  public add (context: { position: Position; blockType: string }) {
    const blockUniqueKey = VuexMixin.generateUuid()
    const block: Block = {
      position: context.position,
      blockType: context.blockType,
      showShadow: false,
      childBlockUniqueKey: '',
      blockUniqueKey,
      parentBlockUniqueKey: '',
      topBlockUniqueKey: ''
    }
    this.addBlock(block)
  }

  @Action({ rawError: true })
  public remove (blockUniqueKey: string) {
    const block = this.allBlocks[blockUniqueKey]
    const topBlock = this.allBlocks[block.topBlockUniqueKey]
    if (topBlock != null && topBlock.blockType === 'DefinitionComponentBlock') {
      const componentUniqueKey = this.objectOfBlockAndComponent[block.topBlockUniqueKey]
      let checkCurrentBlock = this.allBlocks[block.topBlockUniqueKey]
      const componentArr = []
      while (true) {
        componentArr.push({
          blockType: checkCurrentBlock.blockType,
          value: {}
        })
        checkCurrentBlock = this.allBlocks[checkCurrentBlock.childBlockUniqueKey]
        if (checkCurrentBlock.blockUniqueKey === blockUniqueKey) break
      }
      this.removeChild(block.parentBlockUniqueKey)
      store.dispatch('Components/update', { componentUniqueKey, componentArr }, { root: true })
    }
    this.removeBlock(blockUniqueKey)
  }

  @Action({ rawError: true })
  public update (blockArg: Block) {
    this.updateBlock(blockArg)
    this.updateChildBlock(blockArg)
    const blockUniqueKey = blockArg.blockUniqueKey
    const block = this.allBlocks[blockUniqueKey]
    const position = block.position
    for (const key of Object.keys(this.allBlocks)) {
      if (blockUniqueKey === key) continue
      const blockInSearch = this.allBlocks[key]
      const positionInSearch = blockInSearch.position
      const isNearBy = VuexMixin.isNearbyBlocks(positionInSearch, position)
      const notHaveChildRelation = blockInSearch.childBlockUniqueKey === ''
      if (isNearBy && notHaveChildRelation) {
        this.showShadow(key)
      } else {
        this.hideShadow(key)
      }
    }
  }

  @Action({ rawError: true })
  public stopDragging (blockUniqueKey: string) {
    // ブロック全体から探す
    const block = this.allBlocks[blockUniqueKey]
    const position = block.position
    for (const key of Object.keys(this.allBlocks)) {
      if (blockUniqueKey === key) continue
      const blockInSearch = this.allBlocks[key]
      const positionInSearch = blockInSearch.position
      const isNearby = VuexMixin.isNearbyBlocks(positionInSearch, position)
      if (isNearby) {
        position.x = positionInSearch.x
        // TODO: 目視で48に設定してあるが、ブロックの高さに合わせて書くべき
        position.y = positionInSearch.y + VuexMixin.calcHeight(blockInSearch.blockType)
        const processedBlock = this.allBlocks[blockUniqueKey]
        processedBlock.position = position
        this.updateBlock(processedBlock)
        // TODO: 正しく動いているか検証
        this.updateChildBlock(processedBlock)
        if (blockInSearch.childBlockUniqueKey === '') {
          const payload = {
            blockUniqueKey: key,
            childBlockUniqueKey: blockUniqueKey
          }
          this.addChild(payload)
          if (blockInSearch.blockType === 'DefinitionComponentBlock') {
            const blockComponentUniqueKey = VuexMixin.generateUuid()
            this.addRelationBlockAndComponent(key, blockComponentUniqueKey)
            const blocks: { [key: string]: Block } = {}
            let currentBlock = this.allBlocks[key]
            while (true) {
              blocks[currentBlock.blockUniqueKey] = currentBlock
              if (currentBlock.childBlockUniqueKey === '') break
              currentBlock = this.allBlocks[currentBlock.childBlockUniqueKey]
            }
            // TODO: 別のモジュールのActionを呼ぶ方法を調べる
            const blockComponent: BlockComponent = {
              blockComponentUniqueKey,
              blocks
            }
            console.log(blockComponent)
            blockComponentsModule.add(blockComponent)
          }
          const topBlock = this.allBlocks[blockInSearch.topBlockUniqueKey]
          if (topBlock != null && topBlock.blockType === 'DefinitionComponentBlock') {
            const blockComponentUniqueKey = this.objectOfBlockAndComponent[blockInSearch.topBlockUniqueKey]
            const blocks: { [key: string]: Block } = {}
            let currentBlock = this.allBlocks[key]
            while (true) {
              blocks[currentBlock.blockUniqueKey] = currentBlock
              if (currentBlock.childBlockUniqueKey === '') break
              currentBlock = this.allBlocks[currentBlock.childBlockUniqueKey]
            }
            // TODO: 別のモジュールのActionを呼ぶ方法を調べる
            const blockComponent: BlockComponent = {
              blockComponentUniqueKey,
              blocks
            }
            blockComponentsModule.update(blockComponent)
          }
        }
        this.hideShadow(key)
      } else if (blockInSearch.childBlockUniqueKey === blockUniqueKey && blockUniqueKey !== key) {
        this.removeChild(key)
        const topBlock = this.allBlocks[blockInSearch.topBlockUniqueKey]
        if (topBlock != null && topBlock.blockType === 'DefinitionComponentBlock') {
          const blockComponentUniqueKey = this.objectOfBlockAndComponent[blockInSearch.topBlockUniqueKey]
          const blocks: { [key: string]: Block } = {}
          let currentBlock = this.allBlocks[blockInSearch.topBlockUniqueKey]
          while (true) {
            blocks[currentBlock.blockUniqueKey] = currentBlock
            if (currentBlock.childBlockUniqueKey === '') break
            currentBlock = this.allBlocks[currentBlock.childBlockUniqueKey]
          }
          const blockComponent: BlockComponent = {
            blockComponentUniqueKey,
            blocks
          }
          blockComponentsModule.update(blockComponent)
        }
        if (blockInSearch.blockType === 'DefinitionComponentBlock') {
          const blockComponentUniqueKey = this.objectOfBlockAndComponent[key]
          this.removeRelationBlockAndComponent(key)
          blockComponentsModule.remove(blockComponentUniqueKey)
        }
      }
    }
  }
}

export const blocksModule = getModule(Blocks)